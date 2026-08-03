import {
  AddInstruction,
  ArgInstruction,
  CmdInstruction,
  Comment,
  CopyInstruction,
  Dockerfile,
  EntrypointInstruction,
  EnvInstruction,
  ExposeInstruction,
  FromInstruction,
  HealthcheckInstruction,
  Instruction,
  LabelInstruction,
  MaintainerInstruction,
  MountFlag,
  Node,
  OnbuildInstruction,
  ParserDirective,
  RunInstruction,
  ShellInstruction,
  Stage,
  StopsignalInstruction,
  UserInstruction,
  VolumeInstruction,
  WorkdirInstruction,
} from './types';

/**
 * Deparser options
 */
export interface DeparserOptions {
  newline?: string;
  indent?: string;
}

/**
 * Dockerfile Deparser - converts AST back to source
 */
export class Deparser {
  private options: DeparserOptions;

  constructor(options: DeparserOptions = {}) {
    this.options = {
      newline: '\n',
      indent: '',
      ...options
    };
  }

  /**
   * Deparse Dockerfile AST to source string
   */
  deparse(node: Dockerfile | Node): string {
    if ('type' in node) {
      switch (node.type) {
      case 'Dockerfile':
        return this.deparseDockerfile(node as Dockerfile);
      case 'ParserDirective':
        return this.deparseDirective(node as ParserDirective);
      case 'Stage':
        return this.deparseStage(node as Stage);
      case 'Comment':
        return this.deparseComment(node as Comment);
      case 'FromInstruction':
        return this.deparseFrom(node as FromInstruction);
      case 'RunInstruction':
        return this.deparseRun(node as RunInstruction);
      case 'CmdInstruction':
        return this.deparseCmd(node as CmdInstruction);
      case 'EntrypointInstruction':
        return this.deparseEntrypoint(node as EntrypointInstruction);
      case 'CopyInstruction':
        return this.deparseCopy(node as CopyInstruction);
      case 'AddInstruction':
        return this.deparseAdd(node as AddInstruction);
      case 'EnvInstruction':
        return this.deparseEnv(node as EnvInstruction);
      case 'ArgInstruction':
        return this.deparseArg(node as ArgInstruction);
      case 'WorkdirInstruction':
        return this.deparseWorkdir(node as WorkdirInstruction);
      case 'UserInstruction':
        return this.deparseUser(node as UserInstruction);
      case 'ExposeInstruction':
        return this.deparseExpose(node as ExposeInstruction);
      case 'VolumeInstruction':
        return this.deparseVolume(node as VolumeInstruction);
      case 'LabelInstruction':
        return this.deparseLabel(node as LabelInstruction);
      case 'ShellInstruction':
        return this.deparseShell(node as ShellInstruction);
      case 'HealthcheckInstruction':
        return this.deparseHealthcheck(node as HealthcheckInstruction);
      case 'StopsignalInstruction':
        return this.deparseStopsignal(node as StopsignalInstruction);
      case 'OnbuildInstruction':
        return this.deparseOnbuild(node as OnbuildInstruction);
      case 'MaintainerInstruction':
        return this.deparseMaintainer(node as MaintainerInstruction);
      default:
        throw new Error(`Unknown node type: ${(node as any).type}`);
      }
    }
    throw new Error('Invalid node');
  }

  /**
   * Deparse entire Dockerfile
   */
  private deparseDockerfile(dockerfile: Dockerfile): string {
    const lines: string[] = [];

    // Directives first
    for (const directive of dockerfile.directives) {
      lines.push(this.deparseDirective(directive));
    }

    // Then stages, separated by a blank line — unless the stage already places
    // that separator itself via blankBefore (on the stage, or on the first of
    // its leading comments). A separator is never inserted where the AST does
    // not ask for one: an invented blank line would come back as blankBefore on
    // the next parse and break the round-trip.
    dockerfile.stages.forEach((stage, index) => {
      if (index > 0 && !this.leadsWithBlank(stage)) {
        lines.push('');
      }
      lines.push(this.deparseStage(stage));
    });

    for (const comment of dockerfile.trailingComments ?? []) {
      if (comment.blankBefore) {
        lines.push('');
      }
      lines.push(this.deparseComment(comment));
    }

    return lines.join(this.options.newline);
  }

  /**
   * Prefix a node's rendered lines with its blank line and leading comments
   */
  private withLeading(node: Node, rendered: string): string {
    const lines: string[] = [];
    // Each comment carries its own blank line, so a blank above the comment
    // block and a blank between the block and the instruction stay distinct.
    for (const comment of node.leadingComments ?? []) {
      if (comment.blankBefore) {
        lines.push('');
      }
      lines.push(this.deparseComment(comment));
    }
    if (node.blankBefore) {
      lines.push('');
    }
    lines.push(rendered);
    return lines.join(this.options.newline);
  }

  /**
   * Whether a node already renders a blank line above itself
   */
  private leadsWithBlank(node: Node): boolean {
    const first = node.leadingComments?.[0];
    return first ? Boolean(first.blankBefore) : Boolean(node.blankBefore);
  }

  /**
   * Deparse parser directive
   */
  private deparseDirective(directive: ParserDirective): string {
    return `# ${directive.directive}=${directive.value}`;
  }

  /**
   * Deparse build stage
   */
  private deparseStage(stage: Stage): string {
    const lines: string[] = [];

    // FROM instruction
    lines.push(this.withLeading(stage.from, this.deparseFrom(stage.from)));

    // Other instructions
    for (const instruction of stage.instructions) {
      lines.push(this.withLeading(instruction, this.deparseInstruction(instruction)));
    }

    return this.withLeading(stage, lines.join(this.options.newline));
  }

  /**
   * Deparse comment
   */
  private deparseComment(comment: Comment): string {
    // An empty comment is a bare `#`; `# ` would add trailing whitespace.
    return comment.value ? `# ${comment.value}` : '#';
  }

  /**
   * Deparse any instruction
   */
  private deparseInstruction(instruction: Instruction): string {
    switch (instruction.type) {
    case 'FromInstruction':
      return this.deparseFrom(instruction);
    case 'RunInstruction':
      return this.deparseRun(instruction);
    case 'CmdInstruction':
      return this.deparseCmd(instruction);
    case 'EntrypointInstruction':
      return this.deparseEntrypoint(instruction);
    case 'CopyInstruction':
      return this.deparseCopy(instruction);
    case 'AddInstruction':
      return this.deparseAdd(instruction);
    case 'EnvInstruction':
      return this.deparseEnv(instruction);
    case 'ArgInstruction':
      return this.deparseArg(instruction);
    case 'WorkdirInstruction':
      return this.deparseWorkdir(instruction);
    case 'UserInstruction':
      return this.deparseUser(instruction);
    case 'ExposeInstruction':
      return this.deparseExpose(instruction);
    case 'VolumeInstruction':
      return this.deparseVolume(instruction);
    case 'LabelInstruction':
      return this.deparseLabel(instruction);
    case 'ShellInstruction':
      return this.deparseShell(instruction);
    case 'HealthcheckInstruction':
      return this.deparseHealthcheck(instruction);
    case 'StopsignalInstruction':
      return this.deparseStopsignal(instruction);
    case 'OnbuildInstruction':
      return this.deparseOnbuild(instruction);
    case 'MaintainerInstruction':
      return this.deparseMaintainer(instruction);
    default:
      throw new Error(`Unknown instruction type: ${(instruction as any).type}`);
    }
  }

  /**
   * Deparse FROM instruction
   */
  private deparseFrom(from: FromInstruction): string {
    const parts: string[] = ['FROM'];

    if (from.platform) {
      parts.push(`--platform=${from.platform}`);
    }

    let imageRef = from.image;
    if (from.tag) {
      imageRef += `:${from.tag}`;
    }
    if (from.digest) {
      imageRef += `@${from.digest}`;
    }
    parts.push(imageRef);

    if (from.name) {
      parts.push('AS', from.name);
    }

    return parts.join(' ');
  }

  /**
   * Deparse RUN instruction
   */
  private deparseRun(run: RunInstruction): string {
    const parts: string[] = ['RUN'];

    // Mount flags
    if (run.mount) {
      for (const mount of run.mount) {
        parts.push(this.deparseMountFlag(mount));
      }
    }

    // Network flag
    if (run.network) {
      parts.push(`--network=${run.network}`);
    }

    // Security flag
    if (run.security) {
      parts.push(`--security=${run.security}`);
    }

    // Command
    if (run.isExec && Array.isArray(run.command)) {
      parts.push(JSON.stringify(run.command));
    } else {
      parts.push(run.command as string);
    }

    return parts.join(' ');
  }

  /**
   * Deparse mount flag
   */
  private deparseMountFlag(mount: MountFlag): string {
    const opts: string[] = [];

    if (mount.type) opts.push(`type=${mount.type}`);
    if (mount.target) opts.push(`target=${mount.target}`);
    if (mount.source) opts.push(`source=${mount.source}`);
    if (mount.from) opts.push(`from=${mount.from}`);
    if (mount.id) opts.push(`id=${mount.id}`);
    if (mount.sharing) opts.push(`sharing=${mount.sharing}`);
    if (mount.readonly) opts.push('readonly');
    if (mount.required) opts.push('required');
    if (mount.mode) opts.push(`mode=${mount.mode}`);
    if (mount.uid) opts.push(`uid=${mount.uid}`);
    if (mount.gid) opts.push(`gid=${mount.gid}`);

    return `--mount=${opts.join(',')}`;
  }

  /**
   * Deparse CMD instruction
   */
  private deparseCmd(cmd: CmdInstruction): string {
    if (cmd.isExec && Array.isArray(cmd.command)) {
      return `CMD ${JSON.stringify(cmd.command)}`;
    }
    return `CMD ${cmd.command}`;
  }

  /**
   * Deparse ENTRYPOINT instruction
   */
  private deparseEntrypoint(entrypoint: EntrypointInstruction): string {
    if (entrypoint.isExec && Array.isArray(entrypoint.command)) {
      return `ENTRYPOINT ${JSON.stringify(entrypoint.command)}`;
    }
    return `ENTRYPOINT ${entrypoint.command}`;
  }

  /**
   * Deparse COPY instruction
   */
  private deparseCopy(copy: CopyInstruction): string {
    const parts: string[] = ['COPY'];

    if (copy.from) parts.push(`--from=${copy.from}`);
    if (copy.chown) parts.push(`--chown=${copy.chown}`);
    if (copy.chmod) parts.push(`--chmod=${copy.chmod}`);
    if (copy.link) parts.push('--link');
    if (copy.parents) parts.push('--parents');
    if (copy.exclude) {
      for (const exc of copy.exclude) {
        parts.push(`--exclude=${exc}`);
      }
    }

    parts.push(...copy.sources);
    parts.push(copy.destination);

    return parts.join(' ');
  }

  /**
   * Deparse ADD instruction
   */
  private deparseAdd(add: AddInstruction): string {
    const parts: string[] = ['ADD'];

    if (add.chown) parts.push(`--chown=${add.chown}`);
    if (add.chmod) parts.push(`--chmod=${add.chmod}`);
    if (add.link) parts.push('--link');
    if (add.checksum) parts.push(`--checksum=${add.checksum}`);
    if (add.keepGitDir) parts.push('--keep-git-dir');
    if (add.exclude) {
      for (const exc of add.exclude) {
        parts.push(`--exclude=${exc}`);
      }
    }

    parts.push(...add.sources);
    parts.push(add.destination);

    return parts.join(' ');
  }

  /**
   * Deparse ENV instruction
   */
  private deparseEnv(env: EnvInstruction): string {
    const parts: string[] = ['ENV'];

    for (const variable of env.variables) {
      const value = this.needsQuotes(variable.value) 
        ? `"${variable.value}"` 
        : variable.value;
      parts.push(`${variable.key}=${value}`);
    }

    return parts.join(' ');
  }

  /**
   * Deparse ARG instruction
   */
  private deparseArg(arg: ArgInstruction): string {
    if (arg.defaultValue !== undefined) {
      return `ARG ${arg.name}=${arg.defaultValue}`;
    }
    return `ARG ${arg.name}`;
  }

  /**
   * Deparse WORKDIR instruction
   */
  private deparseWorkdir(workdir: WorkdirInstruction): string {
    return `WORKDIR ${workdir.path}`;
  }

  /**
   * Deparse USER instruction
   */
  private deparseUser(user: UserInstruction): string {
    if (user.group) {
      return `USER ${user.user}:${user.group}`;
    }
    return `USER ${user.user}`;
  }

  /**
   * Deparse EXPOSE instruction
   */
  private deparseExpose(expose: ExposeInstruction): string {
    const ports = expose.ports.map(p => {
      if (p.protocol) {
        return `${p.port}/${p.protocol}`;
      }
      return String(p.port);
    });
    return `EXPOSE ${ports.join(' ')}`;
  }

  /**
   * Deparse VOLUME instruction
   */
  private deparseVolume(volume: VolumeInstruction): string {
    if (volume.paths.length === 1) {
      return `VOLUME ${volume.paths[0]}`;
    }
    return `VOLUME ${JSON.stringify(volume.paths)}`;
  }

  /**
   * Deparse LABEL instruction
   */
  private deparseLabel(label: LabelInstruction): string {
    const parts: string[] = ['LABEL'];

    for (const entry of label.labels) {
      const value = this.needsQuotes(entry.value) 
        ? `"${entry.value}"` 
        : entry.value;
      parts.push(`${entry.key}=${value}`);
    }

    return parts.join(' ');
  }

  /**
   * Deparse SHELL instruction
   */
  private deparseShell(shell: ShellInstruction): string {
    return `SHELL ${JSON.stringify(shell.shell)}`;
  }

  /**
   * Deparse HEALTHCHECK instruction
   */
  private deparseHealthcheck(healthcheck: HealthcheckInstruction): string {
    if (healthcheck.none) {
      return 'HEALTHCHECK NONE';
    }

    const parts: string[] = ['HEALTHCHECK'];

    if (healthcheck.interval) parts.push(`--interval=${healthcheck.interval}`);
    if (healthcheck.timeout) parts.push(`--timeout=${healthcheck.timeout}`);
    if (healthcheck.startPeriod) parts.push(`--start-period=${healthcheck.startPeriod}`);
    if (healthcheck.startInterval) parts.push(`--start-interval=${healthcheck.startInterval}`);
    if (healthcheck.retries !== undefined) parts.push(`--retries=${healthcheck.retries}`);

    if (healthcheck.command) {
      parts.push(this.deparseCmd(healthcheck.command));
    }

    return parts.join(' ');
  }

  /**
   * Deparse STOPSIGNAL instruction
   */
  private deparseStopsignal(stopsignal: StopsignalInstruction): string {
    return `STOPSIGNAL ${stopsignal.signal}`;
  }

  /**
   * Deparse ONBUILD instruction
   */
  private deparseOnbuild(onbuild: OnbuildInstruction): string {
    return `ONBUILD ${this.deparseInstruction(onbuild.trigger)}`;
  }

  /**
   * Deparse MAINTAINER instruction
   */
  private deparseMaintainer(maintainer: MaintainerInstruction): string {
    return `MAINTAINER ${maintainer.maintainer}`;
  }

  /**
   * Check if value needs quotes
   */
  private needsQuotes(value: string): boolean {
    return value.includes(' ') || value.includes('\t') || value.includes('"') || value.includes("'");
  }
}

/**
 * Deparse Dockerfile AST to source string
 */
export function deparse(node: Dockerfile | Node, options?: DeparserOptions): string {
  const deparser = new Deparser(options);
  return deparser.deparse(node);
}

/**
 * Synchronous deparse (same as deparse, for API consistency)
 */
export const deparseSync = deparse;
