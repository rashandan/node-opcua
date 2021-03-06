/**
 * @module opcua.miscellaneous
 */
var util = require("util");
var EventEmitter = require("events").EventEmitter;
var PacketAssembler = require("./../transport/packet_assembler").PacketAssembler;
var BinaryStream = require("./binaryStream").BinaryStream;
var readMessageHeader = require("./../nodeopcua").readMessageHeader;
var assert = require('better-assert');
var hexDump = require("./utils").hexDump;


function readRawMessageHeader(data) {
    var messageHeader = readMessageHeader(new BinaryStream(data));
    return {
        length: messageHeader.length,
        messageHeader: messageHeader
    };
}
exports.readRawMessageHeader = readRawMessageHeader;

/**
 * @class MessageBuilderBase
 * @extends EventEmitter
 * @uses PacketAssembler
 * @constructor
 */
var MessageBuilderBase = function () {

    this.packetAssembler = new PacketAssembler({ readMessageFunc: readRawMessageHeader});

    var self = this;
    this.packetAssembler.on("message", function (messageChunk) {
        self._feed_messageChunk(messageChunk);
    });
    this.packetAssembler.on("newMessage", function (info, data) {

        /**
         *
         * notify the observers that a new message is being built
         * @event start_chunk
         * @param info
         * @param data
         */
        self.emit("start_chunk", info, data);
    });
    this._init_new();
};
util.inherits(MessageBuilderBase, EventEmitter);

MessageBuilderBase.prototype._init_new = function () {
    this.total_size = 0;
    this.blocks = [];
    this.message_chunks = [];
};

MessageBuilderBase.prototype._read_headers = function (binaryStream) {

    this.messageHeader = readMessageHeader(binaryStream);
    assert(binaryStream.length === 8);
    this.secureChannelId = binaryStream.readUInt32();
    assert(binaryStream.length === 12);
};

MessageBuilderBase.prototype._append = function (message_chunk) {

    //xx console.log(hexDump(message_chunk).yellow);
    this.message_chunks.push(message_chunk);

    var binaryStream = new BinaryStream(message_chunk);

    this._read_headers(binaryStream);

    assert(binaryStream.length >= 12);

    if (this.messageHeader.length !== message_chunk.length) {
        throw new Error("Invalid messageChunk size: " +
            "the provided chunk is " + message_chunk.length + " bytes long " +
            "but header specifies " + this.messageHeader.length);
    }

    var offsetBodyStart = binaryStream.length;
    var offsetBodyEnd = this.messageHeader.length;

    this.total_size += (offsetBodyEnd - offsetBodyStart);
    this.offsetBodyStart = offsetBodyStart;

    // add message body to a queue
    // note : Buffer.slice create a shared memory !
    //        use Buffer.clone
    var shared_buf = message_chunk.slice(offsetBodyStart);
    var cloned_buf = new Buffer(shared_buf.length);
    shared_buf.copy(cloned_buf, 0, 0);

    this.blocks.push(cloned_buf);

};

/**
 * Feed message builder with some data
 * @method feed
 * @param data
 */
MessageBuilderBase.prototype.feed = function (data) {
    this.packetAssembler.feed(data);
};

MessageBuilderBase.prototype._feed_messageChunk = function (messageChunk) {

    assert(messageChunk);
    var messageHeader = readMessageHeader(new BinaryStream(messageChunk));

    /**
     * notify the observers that new message chunk has been received
     * @event chunk
     * @param messageChunk {Buffer} the raw message chunk
     */
    this.emit("chunk", messageChunk);

    if (messageHeader.isFinal === "F") {

        // last message
        this._append(messageChunk);

        var full_message_body = Buffer.concat(this.blocks);

        assert(full_message_body.length === this.total_size);

        /**
         * notify the observers that a full message has been received
         * @event full_message_body
         * @param full_message_body {Buffer} the full message body made of all concatenated chunks.
         */
        this.emit("full_message_body", full_message_body);

        if (this._decode_message_body) {
            this._decode_message_body(full_message_body);
        }

        // be ready for next block
        this._init_new();

    } else if (messageHeader.isFinal === "A") {
        // error
        this.emit("error");

    } else if (messageHeader.isFinal === "C") {
        this._append(messageChunk);

        // check that this packet is in the correct order

        // verify signature

        // decrypt packet

        // if first packet read object type

    }

};

exports.MessageBuilderBase = MessageBuilderBase;
