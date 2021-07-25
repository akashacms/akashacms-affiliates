
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

    it('should run setup', async function() {
        this.timeout(75000);
        await akasha.cacheSetupComplete(config);
    });

});

describe('find products', function() {
    it('should have correct number of products', async function() {
        let found = config.plugin('akashacms-affiliates')
                                    .getAllProducts();
        assert.isNotNull(found);
        assert.isArray(found);
        assert.equal(found.length, 5);
    });

    it('should find product 1785881507', async function() {
        let found = config.plugin('akashacms-affiliates')
                            .getProductData(undefined, '1785881507');
        assert.isNotNull(found);
        assert.isNotArray(found);
        assert.equal(found.productname, 'Node.JS Web Development - Third Edition');
        assert.equal(found.anchorName, 'NodeJSWebDevelopment3rdEdition');
    });

    it('should find product wattzilla75', async function() {
        let found = config.plugin('akashacms-affiliates')
                            .getProductData(undefined, 'wattzilla75');
        assert.isNotNull(found);
        assert.isNotArray(found);
        assert.equal(found.productname, "Wall Wattz: EVSE, Level 2, 75 Amp Output, 25' J1772 charging cable w/ Cable Management System, Satin finish, Type 4X outdoor enclosure");
        assert.equal(found.anchorName, 'wattzilla75');
    });

    it('should find product maxgreen16gen2', async function() {
        let found = config.plugin('akashacms-affiliates')
                            .getProductData(undefined, 'maxgreen16gen2');
        assert.isNotNull(found);
        assert.isNotArray(found);
        assert.equal(found.productname,
            "MAX GREEN Upgraded Version Level 1&Level 2 EV Charger, Portable Electric Vehicle Charger (16A,120V 25FT) Included Five Adapters, Fast EV Home Charging Station");
        assert.equal(found.anchorName,
            'maxgreen16gen2');
    });

    it('should find product in document', async function() {
        let found = config.plugin('akashacms-affiliates')
                            .getProductData('products.html', 'P3-international-P4460-kill-a-watt');
        assert.isOk(found);
        assert.isNotArray(found);
        // console.log(found);
        assert.equal(found.productname,
            "P3 International P4460 Kill A Watt EZ Electricity Usage Monitor");
        assert.equal(found.anchorName,
            'P3-international-P4460-kill-a-watt');
    });

    it('should find product in document with leading slash', async function() {
        let found = config.plugin('akashacms-affiliates')
                            .getProductData('/products.html', 'P3-international-P4460-kill-a-watt');
        assert.isOk(found);
        assert.isNotArray(found);
        // console.log(found);
        assert.equal(found.productname,
            "P3 International P4460 Kill A Watt EZ Electricity Usage Monitor");
        assert.equal(found.anchorName,
            'P3-international-P4460-kill-a-watt');
    });

    it('should find product in document with full file name', async function() {
        let found = config.plugin('akashacms-affiliates')
                            .getProductData('/products.html.md', 'P3-international-P4460-kill-a-watt');
        assert.isOk(found);
        assert.isNotArray(found);
        // console.log(found);
        assert.equal(found.productname,
            "P3 International P4460 Kill A Watt EZ Electricity Usage Monitor");
        assert.equal(found.anchorName,
            'P3-international-P4460-kill-a-watt');
    });

    it('should find product list', async function() {
        let found = config.plugin('akashacms-affiliates')
                            .getProductList(undefined, [
                                '1785881507',
                                'wattzilla75',
                                'maxgreen16gen2',
                                'efergy-elite-wireless-electricity-monitor'
                            ]);
        assert.isNotNull(found);
        assert.isArray(found);
        assert.equal(found.length, 4);

        const expected = [
            {
                productname: 'Node.JS Web Development - Third Edition',
                anchorName: 'NodeJSWebDevelopment3rdEdition'
            },
            {
                productname: "Wall Wattz: EVSE, Level 2, 75 Amp Output, 25' J1772 charging cable w/ Cable Management System, Satin finish, Type 4X outdoor enclosure",
                anchorName: 'wattzilla75'
            },
            {
                productname: "MAX GREEN Upgraded Version Level 1&Level 2 EV Charger, Portable Electric Vehicle Charger (16A,120V 25FT) Included Five Adapters, Fast EV Home Charging Station",
                anchorName: 'maxgreen16gen2'
            },
            {
                productname: "Efergy Elite Wireless Electricity Monitor",
                anchorName: 'efergy-elite-wireless-electricity-monitor'
            }
        ];

        for (let product of found) {
            let matches;
            matches = undefined;
            for (let expector of expected) {
                // console.log(`${product.anchorName} === ${expector.anchorName} -- ${product.productname} === ${expector.productname}`);
                if (product.anchorName === expector.anchorName
                 && product.productname === expector.productname) {
                    matches = product;
                    break;
                }
            }
            assert.isOk(matches);
        }
    });
});

describe('filter products', function() {
    it('should find by code', async function() {
        let found = config.plugin('akashacms-affiliates')
                        .filterProducts(item => {
                            // console.log(`item.code ${item.code} === '1785881507'?`)
                            return item.code === '1785881507';
                        });
        assert.equal(found.length, 1);
        assert.equal(found[0].anchorName, "NodeJSWebDevelopment3rdEdition");
        assert.equal(found[0].productname, "Node.JS Web Development - Third Edition");
    });

    it('should find items', async function() {
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
    });
});

describe('SHUTDOWN', function() {
    it('should close the configuration', async function() {
        this.timeout(75000);
        await akasha.closeCaches();
    });
});
