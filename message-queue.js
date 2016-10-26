let _ = require('lodash');

module.exports = class MessageQueue {
    constructor(){
        this.queue = [];
    }

    enqueue(messages, expectResponse){
        messages = _.isArray(messages) ? messages : [messages];
        _(messages)
            .map(message => {
                return {
                    message: message,
                    expectResponse: expectResponse
                };
            })
            .forEach(messageObj => {
                this.queue.push(messageObj);
            });
        return this;
    }

    dequeue(){
        return this.queue.shift();
    }

    isEmpty(){
        return this.queue.length === 0;
    }
};