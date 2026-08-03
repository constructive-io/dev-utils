import { parse as parseBash } from 'bash-ast';

import { Lexer, Token, TokenType } from './lexer';
import {
  AddInstruction,
  ArgInstruction,
  BaseNode,
  CmdInstruction,
  Comment,
  CopyInstruction,
  Dockerfile,
  EntrypointInstruction,
  EnvInstruction,
  EnvVariable,
  ExposeInstruction,
  FromInstruction,
  HealthcheckInstruction,
  Instruction,
  LabelEntry,
  LabelInstruction,
  MaintainerInstruction,
  MountFlag,
  OnbuildInstruction,
  ParserDirective,
  PortSpec,
  RunInstruction,
  ShellInstruction,
  Stage,
  StopsignalInstruction,
  UserInstruction,
  VolumeInstruction,
  WorkdirInstruction,
} from './types';

/**
 * Parser options
 */
export interface ParserOptions {
  includeComments?: boolean;
}

/**
 * Dockerfile Parser
 */
export class Parser {
  private tokens: Token[] = [];
  private pos: number = 0;
  private escapeChar: string = '\\';
  private options: ParserOptions;
  /** Comments read but not yet attached to the node they lead. */
  private pendingComments: Comment[] = [];
  /** Whether a blank line preceded the node about to be parsed. */
  private pendingBlank: boolean = false;

  constructor(options: ParserOptions = {}) {
    this.options = {
      includeComments: true,
      ...options
    };
  }

  /**
   * Parse Dockerfile source into AST
   */
  parse(source: string): Dockerfile {
    const lexer = new Lexer(source);
    
    // First pass: look for escape directive
    const tempTokens = lexer.tokenize();
    for (const token of tempTokens) {
      if (token.type === TokenType.DIRECTIVE) {
        const [directive, value] = token.value.split('=');
        if (directive === 'escape' && (value === '\\' || value === '`')) {
          this.escapeChar = value;
          break;
        }
      }
      if (token.type !== TokenType.NEWLINE && token.type !== TokenType.WHITESPACE && token.type !== TokenType.COMMENT) {
        break;
      }
    }

    // Second pass with correct escape character
    const lexer2 = new Lexer(source);
    lexer2.setEscapeChar(this.escapeChar);
    this.tokens = lexer2.tokenize();
    this.pos = 0;

    const dockerfile: Dockerfile = {
      type: 'Dockerfile',
      directives: [],
      stages: [],
      comments: []
    };

    // Parse directives first
    while (!this.isAtEnd()) {
      this.skipWhitespaceAndNewlines();
      if (this.isAtEnd()) break;

      const token = this.peek();
      if (token.type === TokenType.DIRECTIVE) {
        dockerfile.directives.push(this.parseDirective());
      } else if (token.type === TokenType.COMMENT) {
        if (this.options.includeComments) {
          const comment = this.parseComment();
          dockerfile.comments.push(comment);
          this.pendingComments.push(comment);
        } else {
          this.advance();
        }
      } else {
        break;
      }
    }

    // Parse stages and instructions
    let currentStage: Stage | null = null;

    while (!this.isAtEnd()) {
      this.skipWhitespaceAndNewlines();
      if (this.isAtEnd()) break;

      const token = this.peek();

      if (token.type === TokenType.COMMENT) {
        if (this.options.includeComments) {
          const comment = this.takeBlank(this.parseComment());
          dockerfile.comments.push(comment);
          this.pendingComments.push(comment);
        } else {
          this.advance();
        }
        continue;
      }

      if (token.type === TokenType.FROM) {
        const from = this.parseFrom();
        currentStage = this.takeLeading({
          type: 'Stage',
          from,
          instructions: [],
          name: from.name,
          range: from.range
        } as Stage);
        dockerfile.stages.push(currentStage);
        continue;
      }

      // Parse other instructions
      const parsed = this.parseInstruction();
      const instruction = parsed ? this.takeLeading(parsed) : parsed;
      if (instruction) {
        if (currentStage) {
          currentStage.instructions.push(instruction);
        } else {
          // Instructions before first FROM (like ARG)
          if (!dockerfile.stages.length) {
            // Create a virtual stage for pre-FROM instructions
            currentStage = {
              type: 'Stage',
              from: {
                type: 'FromInstruction',
                instruction: 'FROM',
                image: 'scratch'
              },
              instructions: [instruction]
            };
            dockerfile.stages.push(currentStage);
          }
        }
      }
    }

    // Comments after the last instruction lead nothing; keep them so the file
    // can be deparsed without losing its tail.
    if (this.pendingComments.length > 0) {
      dockerfile.trailingComments = this.pendingComments;
      this.pendingComments = [];
    }

    return dockerfile;
  }

  /**
   * Check if at end of tokens
   */
  private isAtEnd(): boolean {
    return this.pos >= this.tokens.length || this.peek().type === TokenType.EOF;
  }

  /**
   * Peek at current token
   */
  private peek(offset: number = 0): Token {
    const idx = this.pos + offset;
    if (idx >= this.tokens.length) {
      return this.tokens[this.tokens.length - 1];
    }
    return this.tokens[idx];
  }

  /**
   * Advance to next token
   */
  private advance(): Token {
    if (!this.isAtEnd()) {
      this.pos++;
    }
    return this.tokens[this.pos - 1];
  }

  /**
   * Skip whitespace and newlines, recording whether a blank line was crossed
   */
  private skipWhitespaceAndNewlines(): void {
    let newlines = 0;
    while (!this.isAtEnd()) {
      const token = this.peek();
      if (token.type === TokenType.NEWLINE) {
        newlines++;
        this.advance();
      } else if (token.type === TokenType.WHITESPACE) {
        this.advance();
      } else {
        break;
      }
    }
    // Two newlines in a row means an empty line between instructions. At the
    // very start of the file there is no preceding instruction to separate from.
    if (newlines > 1 && this.pos > newlines) {
      this.pendingBlank = true;
    }
  }

  /**
   * Attach the comments and blank line collected since the last node
   */
  private takeLeading<T extends BaseNode>(node: T): T {
    if (this.pendingComments.length > 0) {
      node.leadingComments = this.pendingComments;
      this.pendingComments = [];
    }
    return this.takeBlank(node);
  }

  /**
   * Attach only the blank line collected since the last node
   *
   * A comment takes the blank line above it but not the comments above it:
   * consecutive comments are siblings in one block leading the same
   * instruction, not a chain where each leads the next.
   */
  private takeBlank<T extends BaseNode>(node: T): T {
    if (this.pendingBlank) {
      node.blankBefore = true;
      this.pendingBlank = false;
    }
    return node;
  }

  /**
   * Skip whitespace only
   */
  private skipWhitespace(): void {
    while (!this.isAtEnd() && this.peek().type === TokenType.WHITESPACE) {
      this.advance();
    }
  }

  /**
   * Collect arguments until newline
   * Combines key=value tokens into single arguments
   */
  private collectArguments(): string[] {
    const args: string[] = [];
    this.skipWhitespace();
    
    while (!this.isAtEnd()) {
      const token = this.peek();
      if (token.type === TokenType.NEWLINE || token.type === TokenType.EOF) {
        break;
      }
      if (token.type === TokenType.WHITESPACE) {
        this.advance();
        continue;
      }
      
      // Check if this is a key=value pattern (STRING EQUALS STRING)
      if (token.type === TokenType.STRING && this.peek(1).type === TokenType.EQUALS) {
        let combined = token.value;
        this.advance(); // STRING
        combined += this.advance().value; // EQUALS
        if (!this.isAtEnd() && this.peek().type !== TokenType.WHITESPACE && 
            this.peek().type !== TokenType.NEWLINE && this.peek().type !== TokenType.EOF) {
          combined += this.advance().value; // value
        }
        args.push(combined);
      } else {
        args.push(token.value);
        this.advance();
      }
    }
    
    return args;
  }

  /**
   * Collect rest of line as single string
   */
  private collectRestOfLine(): string {
    const parts: string[] = [];
    this.skipWhitespace();
    
    while (!this.isAtEnd()) {
      const token = this.peek();
      if (token.type === TokenType.NEWLINE || token.type === TokenType.EOF) {
        break;
      }
      parts.push(token.value);
      this.advance();
    }
    
    return parts.join('').trim();
  }

  /**
   * Parse parser directive
   */
  private parseDirective(): ParserDirective {
    const token = this.advance();
    const [directive, value] = token.value.split('=');
    return {
      type: 'ParserDirective',
      directive,
      value,
      range: token.range
    };
  }

  /**
   * Parse comment
   */
  private parseComment(): Comment {
    const token = this.advance();
    return {
      type: 'Comment',
      value: token.value,
      range: token.range
    };
  }

  /**
   * Parse FROM instruction
   */
  private parseFrom(): FromInstruction {
    const startToken = this.advance(); // FROM
    this.skipWhitespace();

    let platform: string | undefined;
    let image = '';
    let tag: string | undefined;
    let digest: string | undefined;
    let name: string | undefined;

    // Check for --platform flag
    if (this.peek().type === TokenType.FLAG && this.peek().value.startsWith('--platform')) {
      const flag = this.advance().value;
      if (flag.includes('=')) {
        platform = flag.split('=')[1];
      } else {
        this.skipWhitespace();
        if (this.peek().type === TokenType.EQUALS) {
          this.advance();
        }
        this.skipWhitespace();
        platform = this.advance().value;
      }
      this.skipWhitespace();
    }

    // Parse image reference
    const imageToken = this.advance();
    const imageRef = imageToken.value;

    // Parse image:tag@digest
    if (imageRef.includes('@')) {
      const [beforeDigest, digestPart] = imageRef.split('@');
      digest = digestPart;
      if (beforeDigest.includes(':')) {
        const [imagePart, tagPart] = beforeDigest.split(':');
        image = imagePart;
        tag = tagPart;
      } else {
        image = beforeDigest;
      }
    } else if (imageRef.includes(':')) {
      const [imagePart, tagPart] = imageRef.split(':');
      image = imagePart;
      tag = tagPart;
    } else {
      image = imageRef;
    }

    this.skipWhitespace();

    // Check for AS alias
    if (!this.isAtEnd() && this.peek().type === TokenType.STRING) {
      const maybeAs = this.peek().value.toUpperCase();
      if (maybeAs === 'AS') {
        this.advance(); // AS
        this.skipWhitespace();
        name = this.advance().value;
      }
    }

    return {
      type: 'FromInstruction',
      instruction: 'FROM',
      image,
      tag,
      digest,
      name,
      platform,
      range: startToken.range
    };
  }

  /**
   * Parse instruction based on type
   */
  private parseInstruction(): Instruction | null {
    const token = this.peek();

    switch (token.type) {
    case TokenType.RUN:
      return this.parseRun();
    case TokenType.CMD:
      return this.parseCmd();
    case TokenType.ENTRYPOINT:
      return this.parseEntrypoint();
    case TokenType.COPY:
      return this.parseCopy();
    case TokenType.ADD:
      return this.parseAdd();
    case TokenType.ENV:
      return this.parseEnv();
    case TokenType.ARG:
      return this.parseArg();
    case TokenType.WORKDIR:
      return this.parseWorkdir();
    case TokenType.USER:
      return this.parseUser();
    case TokenType.EXPOSE:
      return this.parseExpose();
    case TokenType.VOLUME:
      return this.parseVolume();
    case TokenType.LABEL:
      return this.parseLabel();
    case TokenType.SHELL:
      return this.parseShell();
    case TokenType.HEALTHCHECK:
      return this.parseHealthcheck();
    case TokenType.STOPSIGNAL:
      return this.parseStopsignal();
    case TokenType.ONBUILD:
      return this.parseOnbuild();
    case TokenType.MAINTAINER:
      return this.parseMaintainer();
    default:
      // Skip unknown tokens
      this.advance();
      return null;
    }
  }

  /**
   * Parse RUN instruction
   */
  private parseRun(): RunInstruction {
    const startToken = this.advance(); // RUN
    this.skipWhitespace();

    const mounts: MountFlag[] = [];
    let network: string | undefined;
    let security: string | undefined;

    // Parse flags
    while (this.peek().type === TokenType.FLAG) {
      const flag = this.advance().value;
      if (flag.startsWith('--mount')) {
        mounts.push(this.parseMountFlag(flag));
      } else if (flag.startsWith('--network')) {
        network = this.extractFlagValue(flag, 'network');
      } else if (flag.startsWith('--security')) {
        security = this.extractFlagValue(flag, 'security');
      }
      this.skipWhitespace();
    }

    // Check for JSON array (exec form)
    if (this.peek().type === TokenType.JSON_ARRAY) {
      const jsonStr = this.advance().value;
      const command = JSON.parse(jsonStr) as string[];
      return {
        type: 'RunInstruction',
        instruction: 'RUN',
        command,
        isExec: true,
        mount: mounts.length > 0 ? mounts : undefined,
        network,
        security,
        range: startToken.range
      };
    }

    // Shell form - also parse with bash-ast for heterogeneous AST
    const command = this.collectRestOfLine();
    let bashAst: unknown;
    try {
      bashAst = parseBash(command);
    } catch {
      // If bash parsing fails, leave bashAst undefined
    }
    return {
      type: 'RunInstruction',
      instruction: 'RUN',
      command,
      isExec: false,
      mount: mounts.length > 0 ? mounts : undefined,
      network,
      security,
      bashAst,
      range: startToken.range
    };
  }

  /**
   * Parse mount flag
   */
  private parseMountFlag(flag: string): MountFlag {
    const mount: MountFlag = { type: 'bind' };
    const value = flag.replace('--mount=', '').replace('--mount', '');
    
    if (value) {
      const parts = value.split(',');
      for (const part of parts) {
        const [key, val] = part.split('=');
        switch (key) {
        case 'type':
          mount.type = val;
          break;
        case 'target':
        case 'dst':
        case 'destination':
          mount.target = val;
          break;
        case 'source':
        case 'src':
          mount.source = val;
          break;
        case 'from':
          mount.from = val;
          break;
        case 'id':
          mount.id = val;
          break;
        case 'sharing':
          mount.sharing = val;
          break;
        case 'readonly':
        case 'ro':
          mount.readonly = val !== 'false';
          break;
        case 'required':
          mount.required = val !== 'false';
          break;
        case 'mode':
          mount.mode = val;
          break;
        case 'uid':
          mount.uid = val;
          break;
        case 'gid':
          mount.gid = val;
          break;
        }
      }
    }
    
    return mount;
  }

  /**
   * Extract value from flag
   */
  private extractFlagValue(flag: string, _name: string): string {
    if (flag.includes('=')) {
      return flag.split('=')[1];
    }
    this.skipWhitespace();
    if (this.peek().type === TokenType.EQUALS) {
      this.advance();
      this.skipWhitespace();
    }
    return this.advance().value;
  }

  /**
   * Parse CMD instruction
   */
  private parseCmd(): CmdInstruction {
    const startToken = this.advance(); // CMD
    this.skipWhitespace();

    if (this.peek().type === TokenType.JSON_ARRAY) {
      const jsonStr = this.advance().value;
      const command = JSON.parse(jsonStr) as string[];
      return {
        type: 'CmdInstruction',
        instruction: 'CMD',
        command,
        isExec: true,
        range: startToken.range
      };
    }

    const command = this.collectRestOfLine();
    return {
      type: 'CmdInstruction',
      instruction: 'CMD',
      command,
      isExec: false,
      range: startToken.range
    };
  }

  /**
   * Parse ENTRYPOINT instruction
   */
  private parseEntrypoint(): EntrypointInstruction {
    const startToken = this.advance(); // ENTRYPOINT
    this.skipWhitespace();

    if (this.peek().type === TokenType.JSON_ARRAY) {
      const jsonStr = this.advance().value;
      const command = JSON.parse(jsonStr) as string[];
      return {
        type: 'EntrypointInstruction',
        instruction: 'ENTRYPOINT',
        command,
        isExec: true,
        range: startToken.range
      };
    }

    const command = this.collectRestOfLine();
    return {
      type: 'EntrypointInstruction',
      instruction: 'ENTRYPOINT',
      command,
      isExec: false,
      range: startToken.range
    };
  }

  /**
   * Parse COPY instruction
   */
  private parseCopy(): CopyInstruction {
    const startToken = this.advance(); // COPY
    this.skipWhitespace();

    let from: string | undefined;
    let chown: string | undefined;
    let chmod: string | undefined;
    let link: boolean | undefined;
    let parents: boolean | undefined;
    const exclude: string[] = [];

    // Parse flags
    while (this.peek().type === TokenType.FLAG) {
      const flag = this.advance().value;
      if (flag.startsWith('--from')) {
        from = this.extractFlagValue(flag, 'from');
      } else if (flag.startsWith('--chown')) {
        chown = this.extractFlagValue(flag, 'chown');
      } else if (flag.startsWith('--chmod')) {
        chmod = this.extractFlagValue(flag, 'chmod');
      } else if (flag === '--link') {
        link = true;
      } else if (flag === '--parents') {
        parents = true;
      } else if (flag.startsWith('--exclude')) {
        exclude.push(this.extractFlagValue(flag, 'exclude'));
      }
      this.skipWhitespace();
    }

    const args = this.collectArguments();
    const destination = args.pop() || '';
    const sources = args;

    return {
      type: 'CopyInstruction',
      instruction: 'COPY',
      sources,
      destination,
      from,
      chown,
      chmod,
      link,
      parents,
      exclude: exclude.length > 0 ? exclude : undefined,
      range: startToken.range
    };
  }

  /**
   * Parse ADD instruction
   */
  private parseAdd(): AddInstruction {
    const startToken = this.advance(); // ADD
    this.skipWhitespace();

    let chown: string | undefined;
    let chmod: string | undefined;
    let link: boolean | undefined;
    let checksum: string | undefined;
    let keepGitDir: boolean | undefined;
    const exclude: string[] = [];

    // Parse flags
    while (this.peek().type === TokenType.FLAG) {
      const flag = this.advance().value;
      if (flag.startsWith('--chown')) {
        chown = this.extractFlagValue(flag, 'chown');
      } else if (flag.startsWith('--chmod')) {
        chmod = this.extractFlagValue(flag, 'chmod');
      } else if (flag === '--link') {
        link = true;
      } else if (flag.startsWith('--checksum')) {
        checksum = this.extractFlagValue(flag, 'checksum');
      } else if (flag === '--keep-git-dir') {
        keepGitDir = true;
      } else if (flag.startsWith('--exclude')) {
        exclude.push(this.extractFlagValue(flag, 'exclude'));
      }
      this.skipWhitespace();
    }

    const args = this.collectArguments();
    const destination = args.pop() || '';
    const sources = args;

    return {
      type: 'AddInstruction',
      instruction: 'ADD',
      sources,
      destination,
      chown,
      chmod,
      link,
      checksum,
      keepGitDir,
      exclude: exclude.length > 0 ? exclude : undefined,
      range: startToken.range
    };
  }

  /**
   * Parse ENV instruction
   */
  private parseEnv(): EnvInstruction {
    const startToken = this.advance(); // ENV
    this.skipWhitespace();

    const variables: EnvVariable[] = [];
    const args = this.collectArguments();

    // Check for key=value or key value format
    if (args.length === 2 && !args[0].includes('=')) {
      // Old format: ENV key value
      variables.push({ key: args[0], value: args[1] });
    } else {
      // New format: ENV key=value key2=value2
      for (const arg of args) {
        if (arg.includes('=')) {
          const eqIdx = arg.indexOf('=');
          const key = arg.substring(0, eqIdx);
          const value = arg.substring(eqIdx + 1);
          variables.push({ key, value: this.unquote(value) });
        }
      }
    }

    return {
      type: 'EnvInstruction',
      instruction: 'ENV',
      variables,
      range: startToken.range
    };
  }

  /**
   * Parse ARG instruction
   */
  private parseArg(): ArgInstruction {
    const startToken = this.advance(); // ARG
    this.skipWhitespace();

    const arg = this.collectRestOfLine();
    let name: string;
    let defaultValue: string | undefined;

    if (arg.includes('=')) {
      const eqIdx = arg.indexOf('=');
      name = arg.substring(0, eqIdx);
      defaultValue = arg.substring(eqIdx + 1);
    } else {
      name = arg;
    }

    return {
      type: 'ArgInstruction',
      instruction: 'ARG',
      name,
      defaultValue,
      range: startToken.range
    };
  }

  /**
   * Parse WORKDIR instruction
   */
  private parseWorkdir(): WorkdirInstruction {
    const startToken = this.advance(); // WORKDIR
    this.skipWhitespace();

    const path = this.collectRestOfLine();

    return {
      type: 'WorkdirInstruction',
      instruction: 'WORKDIR',
      path,
      range: startToken.range
    };
  }

  /**
   * Parse USER instruction
   */
  private parseUser(): UserInstruction {
    const startToken = this.advance(); // USER
    this.skipWhitespace();

    const userSpec = this.collectRestOfLine();
    let user: string;
    let group: string | undefined;

    if (userSpec.includes(':')) {
      [user, group] = userSpec.split(':');
    } else {
      user = userSpec;
    }

    return {
      type: 'UserInstruction',
      instruction: 'USER',
      user,
      group,
      range: startToken.range
    };
  }

  /**
   * Parse EXPOSE instruction
   */
  private parseExpose(): ExposeInstruction {
    const startToken = this.advance(); // EXPOSE
    this.skipWhitespace();

    const args = this.collectArguments();
    const ports: PortSpec[] = [];

    for (const arg of args) {
      if (arg.includes('/')) {
        const [port, protocol] = arg.split('/');
        ports.push({ port, protocol: protocol as 'tcp' | 'udp' });
      } else {
        ports.push({ port: arg });
      }
    }

    return {
      type: 'ExposeInstruction',
      instruction: 'EXPOSE',
      ports,
      range: startToken.range
    };
  }

  /**
   * Parse VOLUME instruction
   */
  private parseVolume(): VolumeInstruction {
    const startToken = this.advance(); // VOLUME
    this.skipWhitespace();

    let paths: string[];

    if (this.peek().type === TokenType.JSON_ARRAY) {
      const jsonStr = this.advance().value;
      paths = JSON.parse(jsonStr) as string[];
    } else {
      paths = this.collectArguments();
    }

    return {
      type: 'VolumeInstruction',
      instruction: 'VOLUME',
      paths,
      range: startToken.range
    };
  }

  /**
   * Parse LABEL instruction
   */
  private parseLabel(): LabelInstruction {
    const startToken = this.advance(); // LABEL
    this.skipWhitespace();

    const labels: LabelEntry[] = [];
    const args = this.collectArguments();

    for (const arg of args) {
      if (arg.includes('=')) {
        const eqIdx = arg.indexOf('=');
        const key = arg.substring(0, eqIdx);
        const value = arg.substring(eqIdx + 1);
        labels.push({ key, value: this.unquote(value) });
      }
    }

    return {
      type: 'LabelInstruction',
      instruction: 'LABEL',
      labels,
      range: startToken.range
    };
  }

  /**
   * Parse SHELL instruction
   */
  private parseShell(): ShellInstruction {
    const startToken = this.advance(); // SHELL
    this.skipWhitespace();

    let shell: string[];

    if (this.peek().type === TokenType.JSON_ARRAY) {
      const jsonStr = this.advance().value;
      shell = JSON.parse(jsonStr) as string[];
    } else {
      shell = this.collectArguments();
    }

    return {
      type: 'ShellInstruction',
      instruction: 'SHELL',
      shell,
      range: startToken.range
    };
  }

  /**
   * Parse HEALTHCHECK instruction
   */
  private parseHealthcheck(): HealthcheckInstruction {
    const startToken = this.advance(); // HEALTHCHECK
    this.skipWhitespace();

    // Check for NONE
    if (this.peek().type === TokenType.STRING && this.peek().value.toUpperCase() === 'NONE') {
      this.advance();
      return {
        type: 'HealthcheckInstruction',
        instruction: 'HEALTHCHECK',
        none: true,
        range: startToken.range
      };
    }

    let interval: string | undefined;
    let timeout: string | undefined;
    let startPeriod: string | undefined;
    let startInterval: string | undefined;
    let retries: number | undefined;

    // Parse flags
    while (this.peek().type === TokenType.FLAG) {
      const flag = this.advance().value;
      if (flag.startsWith('--interval')) {
        interval = this.extractFlagValue(flag, 'interval');
      } else if (flag.startsWith('--timeout')) {
        timeout = this.extractFlagValue(flag, 'timeout');
      } else if (flag.startsWith('--start-period')) {
        startPeriod = this.extractFlagValue(flag, 'start-period');
      } else if (flag.startsWith('--start-interval')) {
        startInterval = this.extractFlagValue(flag, 'start-interval');
      } else if (flag.startsWith('--retries')) {
        retries = parseInt(this.extractFlagValue(flag, 'retries'), 10);
      }
      this.skipWhitespace();
    }

    // Parse CMD (may be tokenized as STRING since it's not at line start)
    let command: CmdInstruction | undefined;
    if (this.peek().type === TokenType.CMD || 
        (this.peek().type === TokenType.STRING && this.peek().value.toUpperCase() === 'CMD')) {
      command = this.parseCmd();
    }

    return {
      type: 'HealthcheckInstruction',
      instruction: 'HEALTHCHECK',
      interval,
      timeout,
      startPeriod,
      startInterval,
      retries,
      command,
      range: startToken.range
    };
  }

  /**
   * Parse STOPSIGNAL instruction
   */
  private parseStopsignal(): StopsignalInstruction {
    const startToken = this.advance(); // STOPSIGNAL
    this.skipWhitespace();

    const signal = this.collectRestOfLine();

    return {
      type: 'StopsignalInstruction',
      instruction: 'STOPSIGNAL',
      signal,
      range: startToken.range
    };
  }

  /**
   * Parse ONBUILD instruction
   */
  private parseOnbuild(): OnbuildInstruction {
    const startToken = this.advance(); // ONBUILD
    this.skipWhitespace();

    const trigger = this.parseInstruction();

    return {
      type: 'OnbuildInstruction',
      instruction: 'ONBUILD',
      trigger: trigger!,
      range: startToken.range
    };
  }

  /**
   * Parse MAINTAINER instruction (deprecated)
   */
  private parseMaintainer(): MaintainerInstruction {
    const startToken = this.advance(); // MAINTAINER
    this.skipWhitespace();

    const maintainer = this.collectRestOfLine();

    return {
      type: 'MaintainerInstruction',
      instruction: 'MAINTAINER',
      maintainer,
      range: startToken.range
    };
  }

  /**
   * Remove quotes from string
   */
  private unquote(str: string): string {
    if ((str.startsWith('"') && str.endsWith('"')) ||
        (str.startsWith("'") && str.endsWith("'"))) {
      return str.slice(1, -1);
    }
    return str;
  }
}

/**
 * Parse Dockerfile source into AST
 */
export function parse(source: string, options?: ParserOptions): Dockerfile {
  const parser = new Parser(options);
  return parser.parse(source);
}
