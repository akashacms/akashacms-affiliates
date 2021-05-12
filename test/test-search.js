
const akasha   = require('akasharender');
const { assert } = require('chai');


let config;

describe('build site', function() {
    it('should construct configuration', async function() {
        this.timeout(75000);
        config = new akasha.Configuration();
        config.rootURL("https://example.akashacms.com");
        config.configDir = __dirname;
        config.addLayoutsDir('layouts')
            .addDocumentsDir('documents')
            .addPartialsDir('partials');
        config.use(require('../index.js'));
        config.setMahabhutaConfig({
            recognizeSelfClosing: true,
            recognizeCDATA: true,
            decodeEntities: true
        });
        config.plugin('akashacms-affiliates')
            .loadAffiliateProducts(config, 'test-products.yml');
        config.prepare();
    });
});

describe('filter products', function() {
    it('should find by code', function() {
        let found = config.plugin('akashacms-affiliates')
                        .filterProducts(item => {
                            // console.log(`item.code ${item.code} === '1785881507'?`)
                            return item.code === '1785881507';
                        });
        assert.equal(found.length, 1);
        assert.equal(found[0].anchorName, "NodeJSWebDevelopment3rdEdition");
        assert.equal(found[0].productname, "Node.JS Web Development - Third Edition");
    });

    it('should find items', function() {
        let found = config.plugin('akashacms-affiliates')
                        .filterProducts(item => {
                            return item.attributes
                                && item.attributes.volts
                                && item.attributes.volts === "240 volts";
                        });

        assert.equal(found.length, 2);

        assert.equal(found[0].anchorName, "wattzilla75");
        assert.equal(found[0].productname, "Wall Wattz: EVSE, Level 2, 75 Amp Output, 25' J1772 charging cable w/ Cable Management System, Satin finish, Type 4X outdoor enclosure");

        assert.equal(found[1].anchorName, "maxgreen16gen2");
        assert.equal(found[1].productname, "MAX GREEN Upgraded Version Level 1&Level 2 EV Charger, Portable Electric Vehicle Charger (16A,120V 25FT) Included Five Adapters, Fast EV Home Charging Station");
    })
});
