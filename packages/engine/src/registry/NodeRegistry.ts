import { INodeType, ParamField, PortName } from '../contracts.js';
import { INodeTypeProvider } from '../core/GraphValidator.js';

export interface NodeTypeMetadata {
  type: string;
  label: string;
  category: 'trigger' | 'action' | 'logic';
  outputs: PortName[];
  params: ParamField[];
  credentialType?: string;
}

export class NodeRegistry implements INodeTypeProvider {
  private readonly nodes = new Map<string, INodeType>();

  /**
   * Register a node type implementation.
   * Rejects duplicate registrations.
   */
  public register(node: INodeType): this {
    if (this.nodes.has(node.type)) {
      throw new Error(`Duplicate node type registration: '${node.type}' is already registered.`);
    }
    this.nodes.set(node.type, node);
    return this;
  }

  /**
   * Retrieve node type implementation by type string.
   */
  public get(type: string): INodeType | undefined {
    return this.nodes.get(type);
  }

  /**
   * Check whether a node type is registered.
   */
  public has(type: string): boolean {
    return this.nodes.has(type);
  }

  /**
   * Return all registered node instances.
   */
  public getAll(): INodeType[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Export metadata for all registered nodes.
   * Designed for GET /api/node-types in the server.
   */
  public getMetadataList(): NodeTypeMetadata[] {
    return this.getAll().map((n) => ({
      type: n.type,
      label: n.label,
      category: n.category,
      outputs: [...n.outputs],
      params: [...n.params],
      credentialType: n.credentialType,
    }));
  }
}

