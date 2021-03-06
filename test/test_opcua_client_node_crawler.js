var OPCUAServer = require("../lib/server/opcua_server").OPCUAServer;
var OPCUAClient = require("../lib/client/opcua_client").OPCUAClient;
var should = require("should");
var assert = require('better-assert');
var async = require("async");
var util = require("util");
var opcua = require("../lib/nodeopcua");

var debugLog  = require("../lib/misc/utils").make_debugLog(__filename);
var StatusCodes = require("../lib/datamodel/opcua_status_code").StatusCodes;
var browse_service = require("../lib/services/browse_service");

var Variant = require("../lib/datamodel/variant").Variant;
var DataType = require("../lib/datamodel/variant").DataType;

var _ = require("underscore");

var port = 2000;

var build_server_with_temperature_device = require("./helpers/build_server_with_temperature_device").build_server_with_temperature_device;
var perform_operation_on_client_session = require("./helpers/perform_operation_on_client_session").perform_operation_on_client_session;
// var perform_operation_on_subscription = require("./helpers/perform_operation_on_client_session").perform_operation_on_subscription;

var NodeCrawler = require("../lib/client/node_crawler").NodeCrawler;

describe("NodeCrawler",function(){

    // this test could be particularly slow on RapsberryPi or BeagleBoneBlack
    // so we set a big enough timeout 
    if (process.arch === 'arm' ) {
       this.timeout(400000);
    }
    var server , client,temperatureVariableId,endpointUrl ;

    var port = 2001;
    before(function(done){
        // we use a different port for each tests to make sure that there is
        // no left over in the tcp pipe that could generate an error
        port+=1;
        server = build_server_with_temperature_device({ port:port},function() {
            endpointUrl = server.endpoints[0].endpointDescription().endpointUrl;
            temperatureVariableId = server.temperatureVariableId;
            done();
        });
    });

    beforeEach(function(done){
        client = new OPCUAClient();
        done();
    });

    afterEach(function(done){
        client = null;
        done();
    });

    after(function(done){
        server.shutdown(done);
    });



    function MyDumpReference(reference) {
        function f(text,width) {
            return (text + "                                                     ").substring(0,width);
        }
        console.log("    referenceTypeId ",
                f(reference.referenceTypeId.displayText(),35).yellow +
                (  reference.isForward?" => ":" <= ") +
                f(reference.browseName.name,20).blue.bold +
                    "(" + reference.nodeId.displayText().cyan +")"
        );
    }
    function MyDumpReferences(index,references) {
        //xxx console.log(" xxxxxxxxxxxxxxxxx ",references);
        references.forEach(MyDumpReference);
    }


    it("should crawl for a complete tree",function(done) {

        perform_operation_on_client_session(client,endpointUrl,function(session,done){

            var crawler = new NodeCrawler(session);

            var data = {};
            crawler.on("browsed",function(nodeElement,data) {

                console.log("nodeElement ".yellow, nodeElement.browseName, nodeElement.nodeId.displayText());
                var objectIndex = {  findObject: function(nodeId){ return null; }};
                MyDumpReferences(objectIndex,nodeElement.references);

            }).on("end",function(){
                console.log("Data ",data);
            }).on("error",function(err) {
                done(err);
            });

            crawler.crawl("RootFolder",data,function(err){

                crawler.crawl("RootFolder",data,function(err){
                    done();
                });

            });


        },done);
    });

    it("should crawl one at a time",function(done){
        var treeify = require('treeify');
        perform_operation_on_client_session(client,endpointUrl,function(session,done) {

            assert(_.isFunction(done));

            var crawler = new NodeCrawler(session);

            var nodeId = "RootFolder";

            crawler.read(nodeId, function (err, obj) {

                if (!err) {
                    obj.browseName.should.equal("Root");
                    obj.organizes.length.should.equal(3);
                    obj.organizes[0].browseName.should.eql("Objects");
                    obj.organizes[1].browseName.should.eql("Types");
                    obj.organizes[2].browseName.should.eql("Views");
                    obj.hasTypeDefinition.should.eql("FolderType");
                }
                done(err);
            });
        },done);
    });


    it("should crawl faster the second time",function(done){

        perform_operation_on_client_session(client,endpointUrl,function(session,done) {

            assert(_.isFunction(done));

            var crawler = new NodeCrawler(session);

            var nodeId = "RootFolder";

            var startTime = Date.now();

            crawler.read(nodeId, function (err, obj) {

                var intermediateTime1 = Date.now();
                var duration1 = intermediateTime1 - startTime;


                crawler.read(nodeId, function (err, obj) {
                    var intermediateTime2 = Date.now();
                    var duration2 = intermediateTime2 - intermediateTime1;

                    duration1.should.be.greaterThan(duration2);

                    done(err);
                });

            });
        },done);
    });


});
