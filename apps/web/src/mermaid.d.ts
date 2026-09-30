declare module 'mermaid' {
  export type MermaidConfig = {
    startOnLoad?: boolean;
    securityLevel?: 'strict' | 'loose' | 'antiscript' | 'sandbox';
    theme?: 'default' | 'neutral' | 'dark' | 'forest' | 'base';
  };

  export type RenderResult = {
    svg: string;
    bindFunctions?: (element: Element) => void;
  };

  export interface MermaidApi {
    initialize(config: MermaidConfig): void;
    render(id: string, text: string, container?: Element): Promise<RenderResult>;
  }

  const mermaid: MermaidApi;
  export default mermaid;
}
