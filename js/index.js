"use strict";
const fs = require('fs');
const path = require('path');
const events_1 = require('events');
const async = require('async');
const Imap = require('imap');
const mailparser_1 = require('mailparser');
class Pechkin extends events_1.EventEmitter {
    constructor(options) {
        super();
        this.imap = null;
        this.options = null;
        options = options || {};
        this.options = {
            tls: !!options.tls,
            autotls: options.autotls,
            tlsOptions: options.tlsOptions || {},
            port: options.port,
            host: options.host,
            user: options.user,
            password: options.password,
            xoauth: options.xoauth,
            xoauth2: options.xoauth2,
            connTimeout: options.connTimeout || 10000,
            authTimeout: options.authTimeout || 10000,
            keepalive: 'keepalive' in options ? options.keepalive : true,
            defaultCharset: options.defaultCharset,
            showAttachmentLinks: !!options.showAttachmentLinks,
            streamAttachments: !!options.streamAttachments,
            unescapeSMTP: !!options.unescapeSMTP,
            mailbox: options.mailbox || "INBOX",
            searchFilter: typeof options.searchFilter === 'string' ? [options.searchFilter] : (options.searchFilter || ["ALL"]),
            markSeen: !!options.markSeen,
            saveAttachments: options.saveAttachments,
            fetchUnreadOnStart: 'fetchUnreadOnStart' in options ? options.fetchUnreadOnStart : true,
            debug: options.debug
        };
        this.imap = new Imap(this.options);
        this.imap.once('ready', this.imapReady.bind(this));
        this.imap.once('close', this.imapClose.bind(this));
        this.imap.on('error', this.imapError.bind(this));
    }
    start() {
        this.imap.connect();
    }
    stop() {
        this.imap.end();
    }
    imapReady() {
        this.imap.openBox(this.options.mailbox, false, (err, mailbox) => {
            if (err) {
                this.emit('error', err);
            }
            else {
                this.emit('connected');
                if (this.options.fetchUnreadOnStart) {
                    this.parseUnread();
                }
                this.imap.on('mail', this.imapMail);
            }
        });
    }
    imapClose() {
        this.emit('disconnected');
    }
    imapError(err) {
        this.emit('error', err);
    }
    imapMail() {
        this.parseUnread();
    }
    parseUnread() {
        this.imap.search(this.options.searchFilter, (err, results) => {
            if (err) {
                this.emit('error', err);
            }
            else if (results.length > 0) {
                async.each(results, (result, cb) => {
                    var f = this.imap.fetch(result, {
                        bodies: '',
                        markSeen: this.options.markSeen
                    });
                    f.on('message', (msg, seqno) => {
                        var parser = new mailparser_1.MailParser(this.options);
                        var attributes = null;
                        parser.on("end", mail => {
                            if (!this.options.streamAttachments && mail.attachments && this.options.saveAttachments) {
                                async.each(mail.attachments, (attachment, callback) => {
                                    let file = path.join(this.options.saveAttachments, attachment.generatedFileName);
                                    fs.writeFile(file, attachment.content, err => {
                                        if (err) {
                                            this.emit('error', err);
                                            callback();
                                        }
                                        else {
                                            attachment.path = path.resolve(file);
                                            this.emit('attachment', attachment);
                                            callback();
                                        }
                                    });
                                }, err => {
                                    this.emit('mail', mail, seqno, attributes);
                                    cb();
                                });
                            }
                            else {
                                this.emit('mail', mail, seqno, attributes);
                            }
                        });
                        parser.on("attachment", attachment => {
                            this.emit('attachment', attachment);
                        });
                        msg.on('body', (stream, info) => {
                            stream.pipe(parser);
                        });
                        msg.on('attributes', attrs => {
                            attributes = attrs;
                        });
                    });
                    f.once('error', err => {
                        this.emit('error', err);
                    });
                }, err => {
                    if (err) {
                        this.emit('error', err);
                    }
                });
            }
        });
    }
}
exports.Pechkin = Pechkin;
