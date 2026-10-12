declare module 'robots-parser' {
    export default function(url: string, content: string): any;
}

declare module 'kanpai-scraper/dist/index.js' {
    export type KanpaiExecutable = string | ((value: string) => unknown) | KanpaiExecutable[] | { [key: string]: KanpaiExecutable };
    export class KanpaiContext {
        constructor(html: string);
    }
    export function executeKanpai<T>(context: KanpaiContext, executable: KanpaiExecutable, options: { strict: boolean }): T;
}
