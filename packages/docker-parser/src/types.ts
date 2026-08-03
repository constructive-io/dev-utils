/**
 * Position in source code
 */
export interface Position {
  line: number;
  column: number;
  offset: number;
}

/**
 * Range in source code
 */
export interface Range {
  start: Position;
  end: Position;
}

/**
 * Base node interface
 */
export interface BaseNode {
  type: string;
  range?: Range;
  /**
   * Comment lines immediately above this node, in source order.
   *
   * A Dockerfile's comments explain the instruction they sit on — why a COPY is
   * split out, what busts a cache layer — so they belong to that node rather
   * than to the file. The deparser emits them, which is what lets a generated
   * Dockerfile carry its reasoning and a parsed one survive a round-trip.
   */
  leadingComments?: Comment[];
  /** Emit one blank line above this node (and above its leading comments). */
  blankBefore?: boolean;
}

/**
 * Dockerfile AST root node
 */
export interface Dockerfile extends BaseNode {
  type: 'Dockerfile';
  directives: ParserDirective[];
  stages: Stage[];
  /**
   * Every comment in the file, in source order, whether or not it is also
   * attached to a node as a leading comment.
   */
  comments: Comment[];
  /** Comments after the last instruction, which lead no node. */
  trailingComments?: Comment[];
}

/**
 * Parser directive (e.g., # escape=\ or # syntax=docker/dockerfile:1)
 */
export interface ParserDirective extends BaseNode {
  type: 'ParserDirective';
  directive: string;
  value: string;
}

/**
 * Build stage (starts with FROM)
 */
export interface Stage extends BaseNode {
  type: 'Stage';
  from: FromInstruction;
  instructions: Instruction[];
  name?: string;
}

/**
 * Comment node
 */
export interface Comment extends BaseNode {
  type: 'Comment';
  value: string;
}

/**
 * Base instruction interface
 */
export interface BaseInstruction extends BaseNode {
  instruction: string;
}

/**
 * FROM instruction
 */
export interface FromInstruction extends BaseInstruction {
  type: 'FromInstruction';
  instruction: 'FROM';
  image: string;
  tag?: string;
  digest?: string;
  name?: string;
  platform?: string;
}

/**
 * RUN instruction
 * When isExec is false (shell form), bashAst contains the parsed bash AST
 */
export interface RunInstruction extends BaseInstruction {
  type: 'RunInstruction';
  instruction: 'RUN';
  command: string | string[];
  isExec: boolean;
  mount?: MountFlag[];
  network?: string;
  security?: string;
  bashAst?: unknown; // Bash Script AST from bash-ast (heterogeneous parsing)
}

/**
 * Mount flag for RUN instruction
 */
export interface MountFlag {
  type: string;
  target?: string;
  source?: string;
  from?: string;
  id?: string;
  sharing?: string;
  readonly?: boolean;
  required?: boolean;
  mode?: string;
  uid?: string;
  gid?: string;
}

/**
 * CMD instruction
 */
export interface CmdInstruction extends BaseInstruction {
  type: 'CmdInstruction';
  instruction: 'CMD';
  command: string | string[];
  isExec: boolean;
}

/**
 * ENTRYPOINT instruction
 */
export interface EntrypointInstruction extends BaseInstruction {
  type: 'EntrypointInstruction';
  instruction: 'ENTRYPOINT';
  command: string | string[];
  isExec: boolean;
}

/**
 * COPY instruction
 */
export interface CopyInstruction extends BaseInstruction {
  type: 'CopyInstruction';
  instruction: 'COPY';
  sources: string[];
  destination: string;
  from?: string;
  chown?: string;
  chmod?: string;
  link?: boolean;
  parents?: boolean;
  exclude?: string[];
}

/**
 * ADD instruction
 */
export interface AddInstruction extends BaseInstruction {
  type: 'AddInstruction';
  instruction: 'ADD';
  sources: string[];
  destination: string;
  chown?: string;
  chmod?: string;
  link?: boolean;
  checksum?: string;
  keepGitDir?: boolean;
  exclude?: string[];
}

/**
 * ENV instruction
 */
export interface EnvInstruction extends BaseInstruction {
  type: 'EnvInstruction';
  instruction: 'ENV';
  variables: EnvVariable[];
}

/**
 * Environment variable
 */
export interface EnvVariable {
  key: string;
  value: string;
}

/**
 * ARG instruction
 */
export interface ArgInstruction extends BaseInstruction {
  type: 'ArgInstruction';
  instruction: 'ARG';
  name: string;
  defaultValue?: string;
}

/**
 * WORKDIR instruction
 */
export interface WorkdirInstruction extends BaseInstruction {
  type: 'WorkdirInstruction';
  instruction: 'WORKDIR';
  path: string;
}

/**
 * USER instruction
 */
export interface UserInstruction extends BaseInstruction {
  type: 'UserInstruction';
  instruction: 'USER';
  user: string;
  group?: string;
}

/**
 * EXPOSE instruction
 */
export interface ExposeInstruction extends BaseInstruction {
  type: 'ExposeInstruction';
  instruction: 'EXPOSE';
  ports: PortSpec[];
}

/**
 * Port specification
 */
export interface PortSpec {
  port: number | string;
  protocol?: 'tcp' | 'udp';
}

/**
 * VOLUME instruction
 */
export interface VolumeInstruction extends BaseInstruction {
  type: 'VolumeInstruction';
  instruction: 'VOLUME';
  paths: string[];
}

/**
 * LABEL instruction
 */
export interface LabelInstruction extends BaseInstruction {
  type: 'LabelInstruction';
  instruction: 'LABEL';
  labels: LabelEntry[];
}

/**
 * Label entry
 */
export interface LabelEntry {
  key: string;
  value: string;
}

/**
 * SHELL instruction
 */
export interface ShellInstruction extends BaseInstruction {
  type: 'ShellInstruction';
  instruction: 'SHELL';
  shell: string[];
}

/**
 * HEALTHCHECK instruction
 */
export interface HealthcheckInstruction extends BaseInstruction {
  type: 'HealthcheckInstruction';
  instruction: 'HEALTHCHECK';
  none?: boolean;
  interval?: string;
  timeout?: string;
  startPeriod?: string;
  startInterval?: string;
  retries?: number;
  command?: CmdInstruction;
}

/**
 * STOPSIGNAL instruction
 */
export interface StopsignalInstruction extends BaseInstruction {
  type: 'StopsignalInstruction';
  instruction: 'STOPSIGNAL';
  signal: string;
}

/**
 * ONBUILD instruction
 */
export interface OnbuildInstruction extends BaseInstruction {
  type: 'OnbuildInstruction';
  instruction: 'ONBUILD';
  trigger: Instruction;
}

/**
 * MAINTAINER instruction (deprecated)
 */
export interface MaintainerInstruction extends BaseInstruction {
  type: 'MaintainerInstruction';
  instruction: 'MAINTAINER';
  maintainer: string;
}

/**
 * Union type for all instructions
 */
export type Instruction =
  | FromInstruction
  | RunInstruction
  | CmdInstruction
  | EntrypointInstruction
  | CopyInstruction
  | AddInstruction
  | EnvInstruction
  | ArgInstruction
  | WorkdirInstruction
  | UserInstruction
  | ExposeInstruction
  | VolumeInstruction
  | LabelInstruction
  | ShellInstruction
  | HealthcheckInstruction
  | StopsignalInstruction
  | OnbuildInstruction
  | MaintainerInstruction;

/**
 * Union type for all AST nodes
 */
export type Node =
  | Dockerfile
  | ParserDirective
  | Stage
  | Comment
  | Instruction;
