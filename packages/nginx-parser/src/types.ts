/**
 * Range represents a position in the source text
 */
export interface Range {
  start: Position;
  end: Position;
}

/**
 * Position represents a line and column in the source text
 */
export interface Position {
  line: number;
  column: number;
}

/**
 * Base node type for all AST nodes
 */
export interface BaseNode {
  type: string;
  range?: Range;
}

/**
 * Comment node
 */
export interface Comment extends BaseNode {
  type: 'Comment';
  value: string;
}

/**
 * Directive node - a simple nginx directive like "worker_processes 4;"
 */
export interface Directive extends BaseNode {
  type: 'Directive';
  name: string;
  args: string[];
}

/**
 * Block node - a directive with a body like "server { ... }"
 */
export interface Block extends BaseNode {
  type: 'Block';
  name: string;
  args: string[];
  body: Statement[];
}

/**
 * If block - special block for conditional logic
 */
export interface IfBlock extends BaseNode {
  type: 'IfBlock';
  condition: string;
  body: Statement[];
}

/**
 * Map block - special block for variable mapping
 */
export interface MapBlock extends BaseNode {
  type: 'MapBlock';
  source: string;
  variable: string;
  body: MapEntry[];
}

/**
 * Map entry - a single mapping in a map block
 */
export interface MapEntry extends BaseNode {
  type: 'MapEntry';
  match: string;
  value: string;
}

/**
 * Geo block - special block for geo-based variable mapping
 */
export interface GeoBlock extends BaseNode {
  type: 'GeoBlock';
  variable: string;
  address?: string;
  body: MapEntry[];
}

/**
 * Upstream block - defines a group of servers
 */
export interface UpstreamBlock extends BaseNode {
  type: 'UpstreamBlock';
  name: string;
  body: Statement[];
}

/**
 * Server block - defines a virtual server
 */
export interface ServerBlock extends BaseNode {
  type: 'ServerBlock';
  body: Statement[];
}

/**
 * Location block - defines request handling for a URI
 */
export interface LocationBlock extends BaseNode {
  type: 'LocationBlock';
  modifier?: '=' | '~' | '~*' | '^~' | '@';
  path: string;
  body: Statement[];
}

/**
 * Http block - the main http context
 */
export interface HttpBlock extends BaseNode {
  type: 'HttpBlock';
  body: Statement[];
}

/**
 * Events block - the events context
 */
export interface EventsBlock extends BaseNode {
  type: 'EventsBlock';
  body: Statement[];
}

/**
 * Stream block - for TCP/UDP proxying
 */
export interface StreamBlock extends BaseNode {
  type: 'StreamBlock';
  body: Statement[];
}

/**
 * Types block - for MIME type definitions
 */
export interface TypesBlock extends BaseNode {
  type: 'TypesBlock';
  body: Statement[];
}

/**
 * Limit except block - for limiting HTTP methods
 */
export interface LimitExceptBlock extends BaseNode {
  type: 'LimitExceptBlock';
  methods: string[];
  body: Statement[];
}

/**
 * Statement is any valid nginx statement
 */
export type Statement =
  | Directive
  | Block
  | IfBlock
  | MapBlock
  | GeoBlock
  | UpstreamBlock
  | ServerBlock
  | LocationBlock
  | HttpBlock
  | EventsBlock
  | StreamBlock
  | TypesBlock
  | LimitExceptBlock
  | Comment;

/**
 * NginxConfig is the root AST node
 */
export interface NginxConfig extends BaseNode {
  type: 'NginxConfig';
  body: Statement[];
}

/**
 * Any AST node
 */
export type AstNode =
  | NginxConfig
  | Statement
  | MapEntry;
