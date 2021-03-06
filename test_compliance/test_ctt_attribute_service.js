var path = "../../";
require(path+"test/compliance_tests/helpers");

var build_server_with_temperature_device = require(path + "test/helpers/build_server_with_temperature_device").build_server_with_temperature_device;

function include_test(filename, options) {
    var test = require("./" + filename);
    test.register_test(options);
}

describe("COMPLIANCE TESTING", function () {

    var options = {
        server: null,
        endpointUrl: null,
        client: null,
        temperatureVariableId: null
    };

    var port = 2234;
    before(function (done) {
        console.log("\n INFO - building the server ".yellow);
        options.server = build_server_with_temperature_device({ port: port, add_simulation: true}, function () {
            console.log("\n INFO - server built".yellow);
            options.endpointUrl = options.server.endpoints[0].endpointDescription().endpointUrl;
            options.temperatureVariableId = options.server.temperatureVariableId;

            options.client = new OPCUAClient();

            done();
        });
    });
    beforeEach(function (done) {
        done();
    });

    afterEach(function (done) {
        done();
    });

    after(function (done) {
        options.client = null;
        options.server.shutdown(done);
    });

    describe("Address Space Model", function () {
        include_test("address_space_model/address_space_user_write_access_ERR_001.js", options);
    });

    describe("Attribute_Services", function () {
        include_test("attribute_services/attribute_read/024.js", options);
    });

});

