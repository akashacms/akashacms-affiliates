
const akasha  = require('akasharender');

const config = new akasha.Configuration();
config.rootURL("https://example.akashacms.com");
config.configDir = __dirname;
config.addLayoutsDir('layouts')
    .addDocumentsDir('documents')
    .addPartialsDir('partials')
    .addAssetsDir({
        src: 'node_modules/bootstrap/dist',
        dest: 'vendor/bootstrap'
    })
   .addAssetsDir({
        src: 'node_modules/jquery/dist',
        dest: 'vendor/jquery'
    })
    .addAssetsDir({
        src: 'node_modules/popper.js/dist',
        dest: 'vendor/popper.js'
    });
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


config
    .addFooterJavaScript({ href: "/vendor/jquery/jquery.min.js" })
    .addFooterJavaScript({ href: "/vendor/popper.js/umd/popper.min.js" })
    .addFooterJavaScript({ href: "/vendor/bootstrap/js/bootstrap.min.js"  })
    .addStylesheet({       href: "/vendor/bootstrap/css/bootstrap.min.css" });

config.prepare();

module.exports = config;

