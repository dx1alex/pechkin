import { EventEmitter } from 'events';
export declare class Pechkin extends EventEmitter {
    imap: any;
    options: any;
    constructor(options: any);
    start(): void;
    stop(): void;
    imapReady(): void;
    imapClose(): void;
    imapError(err: any): void;
    imapMail(): void;
    parseUnread(): void;
}
