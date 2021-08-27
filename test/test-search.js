
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
        config.use(require('../index.js'))
            .use(require('@akashacms/theme-bootstrap'));
        config.setMahabhutaConfig({
            recognizeSelfClosing: true,
            recognizeCDATA: true,
            decodeEntities: true
        });
        config.plugin("akashacms-affiliates")
            .amazonAffiliateCode(config, 'ca', 'fake-affiliate-code')
            .amazonAffiliateCode(config, 'co-jp', 'fake-affiliate-code')
            .amazonAffiliateCode(config, 'co-uk', 'fake-affiliate-code')
            .amazonAffiliateCode(config, 'com', 'fake-affiliate-code')
            .amazonAffiliateCode(config, 'de', 'fake-affiliate-code')
            .amazonAffiliateCode(config, 'es', 'fake-affiliate-code')
            .amazonAffiliateCode(config, 'fr', 'fake-affiliate-code')
            .amazonAffiliateCode(config, 'it', 'fake-affiliate-code');
        config.plugin('akashacms-affiliates')
            .loadAffiliateProducts(config, 'test-products.yml');
        config.prepare();
    });

    it('should run setup', async function() {
        this.timeout(75000);
        await akasha.cacheSetupComplete(config);
    });

    it('should build site', async function() {
        this.timeout(75000);
        let failed = false;
        let results = await akasha.render(config);
        for (let result of results) {
            if (result.error) {
                failed = true;
                console.error(result.error);
            }
        }
        assert.isFalse(failed);
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

describe('Product Links', function() {
    it('should generate productlinks array', async function() {
        let found = config.plugin('akashacms-affiliates')
                            .getProductData('/products.html.md', 'P3-international-P4460-kill-a-watt');
        assert.isOk(found);
        assert.isNotArray(found);

        const links = config.plugin('akashacms-affiliates')
                            .productLinks(found);
        assert.deepEqual(links, [
            {
              url: 'http://www.amazon.com/P3-International-P4460-Electricity-Monitor/dp/B000RGF29Q/ref=sr_1_2?ie=UTF8&amp;qid=1446772041&amp;sr=8-2&amp;keywords=kilowatt+meter&amp;tag=visforvoltage-20',
              text: 'www.amazon.com',
              tooltip: 'Buy P3 International P4460 Kill A Watt EZ Electricity Usage Monitor',
              rel: 'nofollow noskim'
            },
            {
              url: 'http://www.rakuten.com/prod/p3-international-p4460-kill-a-watt-ez-electricity-usage-monitor/204392275.html',
              rel: 'nofollow',
              text: 'rakuten.com'
            },
            {
              url: 'http://www.smarthome.com/p3-international-p4460-kill-a-watt-ez.html',
              rel: 'nofollow',
              text: 'smarthome.com'
            },
            {
              url: 'http://www.homedepot.com/p/P3-International-Kill-A-Watt-EZ-Meter-P4460/202196388',
              rel: 'nofollow',
              text: 'homedepot.com'
            }
        ]);
    });
});

describe('AMZN Buy Buttons', function() {
    let html;
    let $;

    before(async function() {
        let result = await akasha.readRenderedFile(config, 'buy-buttons.html');
        html = result.html;
        $ = result.$;
    });

    it('should correctly read buy-buttons.html', function() {
        assert.exists(html, 'result exists');
        assert.isString(html, 'result isString');
    });

    it('should generate amazon.ca buy buttons with element', async function() {
        assert.equal($('body #elem-ca-buy').length, 1);
        assert.equal($('body #elem-ca-buy form').attr('action'),
                            'https://www.amazon.ca/gp/aws/cart/add.html');

        assert.equal($('body #elem-ca-buy form input[name="AssociateTag"]').attr('value'),
                            'fake-affiliate-code');
        assert.equal($('body #elem-ca-buy form input[name="ASIN.1"]').attr('value'),
                            'B06Y3KCWD7');
        assert.equal($('body #elem-ca-buy form input[name="Quantity.1"]').attr('value'),
                            '1');
        assert.equal($('body #elem-ca-buy form input[type="image"]').attr('src'),
                            '/vendor/@akashacms/plugin-affiliates/amazon-ca.gif');
    });

    it('should generate amazon.ca buy buttons with macro', async function() {
        assert.equal($('body #macro-ca-buy').length, 1);
        assert.equal($('body #macro-ca-buy form').attr('action'),
                            'https://www.amazon.ca/gp/aws/cart/add.html');

        assert.equal($('body #macro-ca-buy form input[name="AssociateTag"]').attr('value'),
                            'fake-affiliate-code');
        assert.equal($('body #macro-ca-buy form input[name="ASIN.1"]').attr('value'),
                            'B06Y3KCWD7');
        assert.equal($('body #macro-ca-buy form input[name="Quantity.1"]').attr('value'),
                            '1');
        assert.equal($('body #macro-ca-buy form input[type="image"]').attr('src'),
                            '/vendor/@akashacms/plugin-affiliates/amazon-ca.gif');
    });

    it('should generate amazon.co-uk buy buttons with element', async function() {
        assert.equal($('body #elem-co-uk-buy').length, 1);
        assert.equal($('body #elem-co-uk-buy form').attr('action'),
                            'https://www.amazon.co.uk/exec/obidos/dt/assoc/handle-buy-box=B06Y3KCWD7');

        assert.equal($('body #elem-co-uk-buy form input[name="tag-value"]').attr('value'),
                            'fake-affiliate-code');
        assert.equal($('body #elem-co-uk-buy form input[name="asin.B06Y3KCWD7"]').attr('value'),
                            '1');
        assert.equal($('body #elem-co-uk-buy form input[type="image"]').attr('src'),
                            '/vendor/@akashacms/plugin-affiliates/amazon-co-uk.gif');
    });

    it('should generate amazon.co-uk buy buttons with macro', async function() {
        assert.equal($('body #macro-co-uk-buy').length, 1);
        assert.equal($('body #macro-co-uk-buy form').attr('action'),
                            'https://www.amazon.co.uk/exec/obidos/dt/assoc/handle-buy-box=B06Y3KCWD7');

        assert.equal($('body #macro-co-uk-buy form input[name="tag-value"]').attr('value'),
                            'fake-affiliate-code');
        assert.equal($('body #macro-co-uk-buy form input[name="asin.B06Y3KCWD7"]').attr('value'),
                            '1');
        assert.equal($('body #macro-co-uk-buy form input[type="image"]').attr('src'),
                            '/vendor/@akashacms/plugin-affiliates/amazon-co-uk.gif');
    });

    it('should generate amazon.co-jp buy buttons with element', async function() {
        assert.equal($('body #elem-co-jp-buy').length, 1);
        assert.equal($('body #elem-co-jp-buy form').attr('action'),
                            'https://www.amazon.co.jp/gp/aws/cart/add.html');

        assert.equal($('body #elem-co-jp-buy form input[name="AssociateTag"]').attr('value'),
                            'fake-affiliate-code');
        assert.equal($('body #elem-co-jp-buy form input[name="ASIN.1"]').attr('value'),
                            'B06Y3KCWD7');
        assert.equal($('body #elem-co-jp-buy form input[name="Quantity.1"]').attr('value'),
                            '1');
        assert.equal($('body #elem-co-jp-buy form input[type="image"]').attr('src'),
                            'https://rcm-images.amazon.com/images/G/09/extranet/associates/buttons/remote-buy-jp1.gif');
    });

    it('should generate amazon.co-jp buy buttons with macro', async function() {
        assert.equal($('body #macro-co-jp-buy').length, 1);
        assert.equal($('body #macro-co-jp-buy form').attr('action'),
                            'https://www.amazon.co.jp/gp/aws/cart/add.html');

        assert.equal($('body #macro-co-jp-buy form input[name="AssociateTag"]').attr('value'),
                            'fake-affiliate-code');
        assert.equal($('body #macro-co-jp-buy form input[name="ASIN.1"]').attr('value'),
                            'B06Y3KCWD7');
        assert.equal($('body #macro-co-jp-buy form input[name="Quantity.1"]').attr('value'),
                            '1');
        assert.equal($('body #macro-co-jp-buy form input[type="image"]').attr('src'),
                            'https://rcm-images.amazon.com/images/G/09/extranet/associates/buttons/remote-buy-jp1.gif');
    });

    it('should generate amazon.com buy buttons with element', async function() {
        assert.equal($('body #elem-com-buy').length, 1);
        assert.equal($('body #elem-com-buy form').attr('action'),
                            'https://www.amazon.com/gp/aws/cart/add.html');

        assert.equal($('body #elem-com-buy form input[name="AssociateTag"]').attr('value'),
                            'fake-affiliate-code');
        assert.equal($('body #elem-com-buy form input[name="ASIN.1"]').attr('value'),
                            'B06Y3KCWD7');
        assert.equal($('body #elem-com-buy form input[name="Quantity.1"]').attr('value'),
                            '1');
        assert.equal($('body #elem-com-buy form input[type="image"]').attr('src'),
                            '/vendor/@akashacms/plugin-affiliates/amazon-com.gif');
    });

    it('should generate amazon.com buy buttons with macro', async function() {
        assert.equal($('body #macro-com-buy').length, 1);
        assert.equal($('body #macro-com-buy form').attr('action'),
                            'https://www.amazon.com/gp/aws/cart/add.html');

        assert.equal($('body #macro-com-buy form input[name="AssociateTag"]').attr('value'),
                            'fake-affiliate-code');
        assert.equal($('body #macro-com-buy form input[name="ASIN.1"]').attr('value'),
                            'B06Y3KCWD7');
        assert.equal($('body #macro-com-buy form input[name="Quantity.1"]').attr('value'),
                            '1');
        assert.equal($('body #macro-com-buy form input[type="image"]').attr('src'),
                            '/vendor/@akashacms/plugin-affiliates/amazon-com.gif');
    });

    it('should generate amazon.de buy buttons with element', async function() {
        assert.equal($('body #elem-de-buy').length, 1);
        assert.equal($('body #elem-de-buy form').attr('action'),
                            'https://www.amazon.de/exec/obidos/dt/assoc/handle-buy-box=B06Y3KCWD7');

        assert.equal($('body #elem-de-buy form input[name="tag-value"]').attr('value'),
                            'fake-affiliate-code');
        assert.equal($('body #elem-de-buy form input[name="asin.B06Y3KCWD7"]').attr('value'),
                            '1');
        assert.equal($('body #elem-de-buy form input[type="submit"]').attr('value'),
                            'bei Amazon.de kaufen');
    });

    it('should generate amazon.de buy buttons with macro', async function() {
        assert.equal($('body #macro-de-buy').length, 1);
        assert.equal($('body #macro-de-buy form').attr('action'),
                            'https://www.amazon.de/exec/obidos/dt/assoc/handle-buy-box=B06Y3KCWD7');

        assert.equal($('body #macro-de-buy form input[name="tag-value"]').attr('value'),
                            'fake-affiliate-code');
        assert.equal($('body #macro-de-buy form input[name="asin.B06Y3KCWD7"]').attr('value'),
                            '1');
        assert.equal($('body #macro-de-buy form input[type="submit"]').attr('value'),
                            'bei Amazon.de kaufen');
    });

    it('should generate amazon.es buy buttons with element', async function() {
        assert.equal($('body #elem-es-buy').length, 1);
        assert.equal($('body #elem-es-buy form').attr('action'),
                            'https://www.amazon.es/exec/obidos/dt/assoc/handle-buy-box=B06Y3KCWD7');

        assert.equal($('body #elem-es-buy form input[name="tag-value"]').attr('value'),
                            'fake-affiliate-code');
        assert.equal($('body #elem-es-buy form input[name="B06Y3KCWD7"]').attr('value'),
                            '1');
        assert.equal($('body #elem-es-buy form input[type="image"]').attr('src'),
                            'https://images.amazon.com/images/G/30/associates/buttons/buy_4');
    });

    it('should generate amazon.es buy buttons with macro', async function() {
        assert.equal($('body #macro-es-buy').length, 1);
        assert.equal($('body #macro-es-buy form').attr('action'),
                            'https://www.amazon.es/exec/obidos/dt/assoc/handle-buy-box=B06Y3KCWD7');

        assert.equal($('body #macro-es-buy form input[name="tag-value"]').attr('value'),
                            'fake-affiliate-code');
        assert.equal($('body #macro-es-buy form input[name="B06Y3KCWD7"]').attr('value'),
                            '1');
        assert.equal($('body #macro-es-buy form input[type="image"]').attr('src'),
                            'https://images.amazon.com/images/G/30/associates/buttons/buy_4');
    });

    it('should generate amazon.fr buy buttons with element', async function() {
        assert.equal($('body #elem-fr-buy').length, 1);
        assert.equal($('body #elem-fr-buy form').attr('action'),
                            'https://www.amazon.fr/exec/obidos/dt/assoc/handle-buy-box=B06Y3KCWD7');

        assert.equal($('body #elem-fr-buy form input[name="tag-value"]').attr('value'),
                            'fake-affiliate-code');
        assert.equal($('body #elem-fr-buy form input[name="asin.B06Y3KCWD7"]').attr('value'),
                            '1');
        assert.equal($('body #elem-fr-buy form input[type="submit"]').attr('value'),
                            'Achetez chez Amazon.fr');
    });

    it('should generate amazon.fr buy buttons with macro', async function() {
        assert.equal($('body #macro-fr-buy').length, 1);
        assert.equal($('body #macro-fr-buy form').attr('action'),
                            'https://www.amazon.fr/exec/obidos/dt/assoc/handle-buy-box=B06Y3KCWD7');

        assert.equal($('body #macro-fr-buy form input[name="tag-value"]').attr('value'),
                            'fake-affiliate-code');
        assert.equal($('body #macro-fr-buy form input[name="asin.B06Y3KCWD7"]').attr('value'),
                            '1');
        assert.equal($('body #macro-fr-buy form input[type="submit"]').attr('value'),
                            'Achetez chez Amazon.fr');
    });

    it('should generate amazon.it buy buttons with element', async function() {
        assert.equal($('body #elem-it-buy').length, 1);
        assert.equal($('body #elem-it-buy form').attr('action'),
                            'https://www.amazon.it/exec/obidos/dt/assoc/handle-buy-box=B06Y3KCWD7');

        assert.equal($('body #elem-it-buy form input[name="tag-value"]').attr('value'),
                            'fake-affiliate-code');
        assert.equal($('body #elem-it-buy form input[name="asin.$B06Y3KCWD7"]').attr('value'),
                            '1');
        assert.equal($('body #elem-it-buy form input[type="image"]').attr('src'),
                            'https://images.amazon.com/images/G/29/associates/buttons/buy5.gif');
    });

    it('should generate amazon.it buy buttons with macro', async function() {
        assert.equal($('body #macro-it-buy').length, 1);
        assert.equal($('body #macro-it-buy form').attr('action'),
                            'https://www.amazon.it/exec/obidos/dt/assoc/handle-buy-box=B06Y3KCWD7');

        assert.equal($('body #macro-it-buy form input[name="tag-value"]').attr('value'),
                            'fake-affiliate-code');
        assert.equal($('body #macro-it-buy form input[name="asin.$B06Y3KCWD7"]').attr('value'),
                            '1');
        assert.equal($('body #macro-it-buy form input[type="image"]').attr('src'),
                            'https://images.amazon.com/images/G/29/associates/buttons/buy5.gif');
    });

});

describe('Affiliate Product', function() {
    let html;
    let $;

    before(async function() {
        let result = await akasha.readRenderedFile(config, 'products.html');
        html = result.html;
        $ = result.$;
    });

    it('should correctly read products.html', function() {
        assert.exists(html, 'result exists');
        assert.isString(html, 'result isString');
    });

    it('should render efergy-elite-wireless-electricity-monitor', async function() {
        assert.equal($('body #efergy-elite-wireless-electricity-monitor').length, 1);
        assert.equal($('body #efergy-elite-wireless-electricity-monitor .card-img-top').attr('src'),
                    'https://images-na.ssl-images-amazon.com/images/I/71Lx99WgYdL._SL1200_.jpg');
        assert.equal($('body #efergy-elite-wireless-electricity-monitor .card-body button[data-target="#efergy-elite-wireless-electricity-monitor-modal-button"]').length, 1);
        assert.equal($('body #efergy-elite-wireless-electricity-monitor .card-body #efergy-elite-wireless-electricity-monitor-modal-button').length, 1);
        assert.equal($('body #efergy-elite-wireless-electricity-monitor .card-body #efergy-elite-wireless-electricity-monitor-modal-button .affproductname').attr('href'), 'https://www.amazon.com/Efergy-Elite-Wireless-Electricity-Monitor/dp/B003XOXU02/ref=sr_1_16?tag=fake-affiliate-code');
        assert.equal($('body #efergy-elite-wireless-electricity-monitor .card-body #efergy-elite-wireless-electricity-monitor-modal-button img').attr('src'), 'https://images-na.ssl-images-amazon.com/images/I/71Lx99WgYdL._SL1200_.jpg');
        assert.equal($('body #efergy-elite-wireless-electricity-monitor .productdescription').length, 1);
        assert.equal($('body #efergy-elite-wireless-electricity-monitor .productdescription .affproductname').attr('href'), 'https://www.amazon.com/Efergy-Elite-Wireless-Electricity-Monitor/dp/B003XOXU02/ref=sr_1_16?tag=fake-affiliate-code');
        assert.equal($('body #efergy-elite-wireless-electricity-monitor-buy-block').length, 1);
        assert.equal($('body #efergy-elite-wireless-electricity-monitor-buy-block form[action="https://www.amazon.com/gp/aws/cart/add.html"]').length, 1);
        assert.equal($('body #efergy-elite-wireless-electricity-monitor-buy-block form[action="https://www.amazon.com/gp/aws/cart/add.html"] input[name="ASIN.1"]').attr('value'), 'B003XOXU02');
        assert.equal($('body #efergy-elite-wireless-electricity-monitor-buy-block .list-group .list-group-item').length, 4);
    });

    it('should render maxgreen16gen2', function() {
        assert.equal($('body #maxgreen16gen2').length, 1);
        assert.equal($('body #maxgreen16gen2 .card-img-top').attr('src'),
                    'https://images-na.ssl-images-amazon.com/images/I/71pdNWfVx0L._AC_SL1500_.jpg');
        assert.equal($('body #maxgreen16gen2 .card-body button[data-target="#maxgreen16gen2-modal-button"]').length, 1);
        assert.equal($('body #maxgreen16gen2 .card-body #maxgreen16gen2-modal-button').length, 1);
        assert.include($('body #maxgreen16gen2 .card-body #maxgreen16gen2-modal-button .modal-title').html(), 'MAX GREEN Upgraded Version Level');
        assert.equal($('body #maxgreen16gen2 #maxgreen16gen2-modal-button #maxgreen16gen2-modal-carousel').length, 1);
        assert.equal($('body #maxgreen16gen2 .card-body #maxgreen16gen2-modal-button #maxgreen16gen2-modal-carousel .carousel-item img[src="https://images-na.ssl-images-amazon.com/images/I/71pdNWfVx0L._AC_SL1500_.jpg"]').length, 1);
        assert.equal($('body #maxgreen16gen2 .card-body #maxgreen16gen2-modal-button #maxgreen16gen2-modal-carousel .carousel-item img[src="https://images-na.ssl-images-amazon.com/images/I/71x3F75eFuL._AC_SL1500_.jpg"]').length, 1);
        assert.equal($('body #maxgreen16gen2 .card-body #maxgreen16gen2-modal-button #maxgreen16gen2-modal-carousel .carousel-item img[src="https://images-na.ssl-images-amazon.com/images/I/717%2BwhgvZ4L._AC_SL1500_.jpg"]').length, 1);
        assert.equal($('body #maxgreen16gen2 .card-body #maxgreen16gen2-modal-button #maxgreen16gen2-modal-carousel .carousel-item img[src="https://images-na.ssl-images-amazon.com/images/I/61ONTRFfGhL._AC_SL1200_.jpg"]').length, 1);
        assert.equal($('body #maxgreen16gen2 .card-body #maxgreen16gen2-modal-button #maxgreen16gen2-modal-carousel .carousel-item img[src="https://images-na.ssl-images-amazon.com/images/I/81E7wDbdNdL._AC_SL1500_.jpg"]').length, 1);
        assert.equal($('body #maxgreen16gen2 .card-body #maxgreen16gen2-modal-button #maxgreen16gen2-modal-carousel .carousel-item img[src="https://images-na.ssl-images-amazon.com/images/I/71mP0ZvECXL._AC_SL1500_.jpg"]').length, 1);
        assert.equal($('body #maxgreen16gen2 .card-body #maxgreen16gen2-modal-button #maxgreen16gen2-modal-carousel .carousel-item img[src="https://images-na.ssl-images-amazon.com/images/I/61rkZ19vvkL._AC_SL1200_.jpg"]').length, 1);

        assert.include($('body #maxgreen16gen2  .productdescription .affproductname').attr('href'), 'https://www.amazon.com/dp/B07J4VCYKL?linkCode=ll1&tag=fake-affiliate-code&linkId=724a4b82865a81f202f0f7925bf323c2&language=en_US&ref_=as_li_ss_tl');
        assert.include($('body #maxgreen16gen2  .productdescription .affproductname').html(), 'MAX GREEN Upgraded Version Level');
        assert.include($('body #maxgreen16gen2  .card-header').html(), 'MAX GREEN Upgraded Version Level');
    })
});

describe('SHUTDOWN', function() {
    it('should close the configuration', async function() {
        this.timeout(75000);
        await akasha.closeCaches();
    });
});
