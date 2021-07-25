/**
 *
 * Copyright 2017, 2018, 2019 David Herron
 *
 * This file is part of AkashaCMS-affiliates (http://akashacms.com/).
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

'use strict';

const fs        = require('fs/promises');
const url       = require('url');
const URL       = url.URL;
const path      = require('path');
const util      = require('util');
const akasha    = require('akasharender');
const mahabhuta = akasha.mahabhuta;
const yaml      = require('js-yaml');
const domainMatch = require('domain-match');

const pluginName = "akashacms-affiliates";

// This will hold a pointer to the ForerunnerDB collection
// used by this plugin
let cache;
let filecache;

const _plugin_config = Symbol('config');
const _plugin_options = Symbol('options');
const _plugin_data_files = Symbol('filez');

module.exports = class AffiliatesPlugin extends akasha.Plugin {
    constructor() {
        super(pluginName);
    }

    configure(config, options) {
        this[_plugin_config] = config;
        this[_plugin_options] = options;
        options.config = config;
        config.addPartialsDir(path.join(__dirname, 'partials'));
        config.addAssetsDir({
            src: path.join(__dirname, 'buy-images'),
            dest: 'vendor/@akashacms/plugin-affiliates'
        });
        config.addMahabhuta(module.exports.mahabhutaArray(options));
        // options.products = new Map(); // []; -- No longer needed
        options.amazonAffiliateCode = [];
        options.noSkimlinks = [];
        options.noViglinks = [];
        this[_plugin_data_files] = [];
    }

    get config() { return this[_plugin_config]; }
    get options() { return this[_plugin_options]; }

    getCache() {
        const coll = cache.getCache(pluginName, { create: true });
        if (!coll) {
            throw new Error(`${pluginName} getCache failed to getCache ${coll}`);
        }
        return coll;
    }

    // Ensure the cache is set up
    async onPluginCacheSetup() {
        // console.log(`onPluginCacheSetup`);

        cache = await akasha.cache;
        filecache = await akasha.filecache;

        this.getCache();

        for (let datafile of this[_plugin_data_files]) {
            const doc = yaml.safeLoad(await fs.readFile(datafile, 'utf8'));
            // console.log(`onPluginCacheSetup loading ${doc.products.length} items from ${datafile}`);
            // console.log(doc.products.length);
            for (let product of doc.products) {
                if (!product) {
                    throw new Error(`Undefined product found in ${yamlFile}`);
                }
                if (!product.code) {
                    throw new Error(`No product code supplied in ${util.inspect(product)}`);
                }
                this.affiliateProduct(this.config, product.code, product);
            }
        }
    }

    getProductByCode(productid) {
        const coll = this.getCache();
        let found = coll.find({
            code: { $eeq: productid }
        });
        if (!found) return undefined;
        if (!Array.isArray(found)) return undefined;
        if (found.length <= 0) return undefined;
        return found[0];
    }

    deleteProductByCode(productid) {
        const coll = this.getCache();
        coll.remove({
            code: { $eeq: productid }
        });
    }

    affiliateProduct(config, productid, data) {
        const coll = this.getCache();
        let _data = this.getProductByCode(productid);
        if (_data) {
            this.deleteProductByCode(productid);
        }
        if (data.productamzn) {
            data.productamzn = data.productamzn.map(item => {
                item.affcode = this.options.amazonAffiliateCode[item.countryCode];
                return item;
            });
        }
        coll.insert(data);
        // console.log(`NEW affiliateProduct ${productid} ${util.inspect(data.doc)} ${data.productname}`);
    }

    /* affiliateProduct(config, productid, data) {
        if (!productid || productid === '') {
            throw new Error(`Invalid productid ${util.inspect(productid)} for ${util.inspect(data)}`);
        }
        if (data.productamzn) {
            data.productamzn = data.productamzn.map(item => {
                item.affcode = this.options.amazonAffiliateCode[item.countryCode];
                return item;
            });
        }
        if (this.options.products.has(productid)) {
             this.options.products.delete(productid);
        }
        this.options.products.set(productid, data);
        // this.options.products[productid] = data;
        return this;
    } */

    amazonAffiliateCode(config, countryCode, amznCode) {
        this.options.amazonAffiliateCode[countryCode] = amznCode;
        return this;
    }

    amazonCodeForCountry(config, countryCode) {
        return this.options.amazonAffiliateCode[countryCode];
    }

    noSkimlinksDomain(config, domain) {
        this.options.noSkimlinks.push(domain);
        return this;
    }

    doNoSkimlinksForDomain(config, domain) {
        for (var noskimdnm of this.options.noSkimlinks) {
            if (domain.match(noskimdnm)) {
                return true;
            }
        }
        return false;
    }

    noViglinksDomain(config, domain) {
        this.options.noViglinks.push(domain);
        return this;
    }

    doNoViglinksForDomain(config, domain) {
        for (var novigdnm of this.options.noViglinks) {
            if (domain.match(novigdnm)) {
                return true;
            }
        }
        return false;
    }

    loadAffiliateProducts(config, yamlFile) {
        this[_plugin_data_files].push(yamlFile);
    }

    filterProducts(searchFN) {
        const coll = this.getCache();
        const products = coll.find({});
        const ret = [];
        for (let product of products) {
            // console.log(`key ${key} product ${product}`);
            if (searchFN(product)) {
                ret.push(product);
            }
        }
        // console.log(ret);
        return ret;
    }

    // These two hook functions automatically incorporate
    // affiliate product data from any document that has
    // such metadata

    onFileAdded(config, collection, vpinfo) {
        if (vpinfo.docMetadata
         && vpinfo.docMetadata.products
         && Array.isArray(vpinfo.docMetadata.products)) {
            for (let product of vpinfo.docMetadata.products) {
                if (!(product.doc)) product.doc = {};
                product.doc.vpath = vpinfo.vpath;
                product.doc.renderPath = vpinfo.renderPath;
                this.affiliateProduct(config, product.code, product);
            }
        }
    }

    onFileChanged(config, collection, vpinfo) {
        if (vpinfo.docMetadata
         && vpinfo.docMetadata.products
         && Array.isArray(vpinfo.docMetadata.products)) {
            for (let product of vpinfo.docMetadata.products) {
                if (!(product.doc)) product.doc = {};
                product.doc.vpath = vpinfo.vpath;
                product.doc.renderPath = vpinfo.renderPath;
                this.affiliateProduct(config, product.code, product);
            }
        }
    }

    // This hook function automatically removes any
    // affiliate product data corresponding to the
    // document which has been removed

    onFileUnlinked(config, collection, vpinfo) {
        const coll = this.getCache();
        coll.remove({
            doc: { vpath: { $eeq: vpinfo.vpath } }
        });
    }

    select(selector) {
        const coll = this.getCache();
        const found = coll.find(selector);
        if (!found) return undefined;
        if (!Array.isArray(found)) return undefined;
        if (found.length <= 0) return undefined;
        return found;
    }

    getProductData(_href, productid) {
        let href;
        if (_href) {
            href = _href.startsWith('/')
                    ? _href.substring(1)
                    : _href;
        } else {
            href = undefined;
        }
        if (!productid) return this.getRandomProduct(href);
        const selector = {
            code: { $eeq: productid }
        };
        if (href) {
            selector['$or'] = [
                { doc: { vpath: { $eeq: href } } },
                { doc: { renderPath: { $eeq: href } } }
            ];
        }
        const found = this.select(selector);
        if (!found
         || !Array.isArray(found)
         || found.length <= 0) {
            // console.log(`getProductData failed to find anything for ${productid} ${href} ${JSON.stringify(selector)}`);
            // console.log(filecache.documents.find(href));
            return undefined;
         }
        return found[0];
    }

    getProductList(_href, productids) {
        let href;
        if (_href) {
            href = _href.startsWith('/')
                    ? _href.substring(1)
                    : _href;
        } else {
            href = undefined;
        }
        let ret = [];
        for (let productid of productids) {
            ret.push(this.getProductData(href, productid));
        }
        return ret;
    }

    getRandomProduct(_href) {
        let href;
        if (_href) {
            href = _href.startsWith('/')
                    ? _href.substring(1)
                    : _href;
        } else {
            href = undefined;
        }
        const selector = {};
        if (href) {
            selector['$or'] = [
                { doc: { vpath: { $eeq: href } } },
                { doc: { renderPath: { $eeq: href } } }
            ];
        }
        const found = this.select(selector);
        return found[Math.floor(Math.random() * found.length)];
    }

    getAllProducts() {
        return this.select({});
    }

};

function setAmazonAffiliateTag(href, tag) {
    var urlP = url.parse(href, true, true);
    if (! urlP.hasOwnProperty('query')) {
        urlP.query = {};
    }
    urlP.query.tag = tag;
    urlP.search = undefined;
    return url.format(urlP);
}

/* -- NO LONGER NEEDED
async function getProductData(metadata, config, href, productid) {
    const plugin = config.plugin(pluginName);
    let data;
    let products;
    if (href) {
        let doc = await akasha.readDocument(config, href);
        if (doc && "products" in doc.metadata) {
            products = doc.metadata.products;
        }
    }
    if (!products && "products" in metadata) {
        products = metadata.products;
    }
    if (!products) {
        products = plugin.options.products;
    }
    if (!products) {
        throw new Error(`getProductData no products found href=${href} productid=${productid}`);
    }
    if (productid) {
        // Either this is a Map of products instances,
        // Or it is an array of products[productid]
        // Or an array of objects where product.code === productid
        if (products instanceof Map) {
            data = products.get(productid);
        } else if (Array.isArray(products) && products[productid]) {
            data = products[productid];
        } else {
            data = undefined;
            for (let product of products) {
                if (!product) {
                    // skip over anything like this
                    continue;
                }
                if (product.code === productid) {
                    data = product;
                    break;
                }
            }
        }
    } else {
        // If no product ID specified, we can select one at random
        if (products instanceof Map) {
            let prodz = products.values();
            data = prodz[Math.floor(Math.random() * prodz.length)]
        } else {
            data = products[Math.floor(Math.random() * products.length)];
        }
    }
    if (!data) {
        throw new Error(`getProductData failed to find data in ${href} for ${productid}`);
    }

    // Clone the object so we can modify it without risk to the source object
    let _data = data;
    data = {};
    for (var attr in _data) {
        if (_data.hasOwnProperty(attr)) data[attr] = _data[attr];
    }

    return data;
}
*/

/* - NO LONGER NEEDED
async function getProductList(metadata, config, href, productids) {
    let ret = [];
    for (let productid of productids) {
        ret.push(await getProductData(metadata, config, href, productid));
    }
    return ret;
}
*/

module.exports.mahabhutaArray = function(options) {
    let ret = new mahabhuta.MahafuncArray(pluginName, options);
    ret.addMahafunc(new AffiliateLinkMunger());
    ret.addMahafunc(new AffiliateProductContent());
    ret.addMahafunc(new AffiliateProductAccordionContent());
    ret.addMahafunc(new AffiliateProductTableContent());
    ret.addMahafunc(new AffiliateProductLink());
    ret.addMahafunc(new AmazonCABuyButtonElement());
    ret.addMahafunc(new AmazonJPBuyButtonElement());
    ret.addMahafunc(new AmazonUKBuyButtonElement());
    ret.addMahafunc(new AmazonUSABuyButtonElement());
    ret.addMahafunc(new AmazonDEBuyButtonElement());
    ret.addMahafunc(new AmazonESBuyButtonElement());
    ret.addMahafunc(new AmazonFRBuyButtonElement());
    ret.addMahafunc(new AmazonITBuyButtonElement());
    return ret;
};

/**
 * Modify the link as appropriate to rules and regulations about affiliate links.
 * For example, rel=nofollow is required and we must ensure it is set for all links.
 *
 * The actions to take are:
 * 1. DONE For specific domains, ensure the link has rel=nofollow
 * 2. DONE If it's a domain where we are to add affiliate tags, do so
 * 3. If it's a domain where noskim or noviglink is appropriate, do so
 *
 */
class AffiliateLinkMunger extends mahabhuta.Munger {
    get selector() { return "html body a"; }

    process($, $link, metadata, dirty, done) {
        var href     = $link.attr('href');
        var rel      = $link.attr('rel');

        if (!href) return Promise.resolve("");

        // We only act on the link if it is external -- has a PROTOCOL and HOST
        const urlP = url.parse(href, true, true);
        if (urlP.protocol || urlP.host) {

            [
                { country: "com", domain: '*.amazon.com' },
                { country: "ca",  domain: '*.amazon.ca' },
                { country: "co-jp",  domain: '*.amazon.co.jp' },
                { country: "co-uk",  domain: '*.amazon.co.uk' },
                { country: "de",  domain: '*.amazon.de' },
                { country: "es",  domain: '*.amazon.es' },
                { country: "fr",  domain: '*.amazon.fr' },
                { country: "it",  domain: '*.amazon.it' }
            ].forEach(amazonSite => {
                let amazonCode = this.array.options.config.plugin(pluginName)
                        .amazonCodeForCountry(this.array.options.config, amazonSite.country);
                // console.log(`${urlP.hostname} is ${amazonSite.domain}? ${amazonSite.domain.test(urlP.hostname)} amazonCode ${amazonCode}`);
                if (domainMatch(amazonSite.domain, href)
                 && amazonCode) {
                    akasha.linkRelSetAttr($link, 'nofollow', true);
                    $link.attr('href', setAmazonAffiliateTag(href, amazonCode));
                    // console.log(`set href ${$link.attr('href')} rel ${$link.attr('rel')}`);
                }
            });

            if (this.array.options.config.plugin(pluginName).doNoSkimlinksForDomain(this.array.options.config, urlP.hostname)) {
                akasha.linkRelSetAttr($link, 'noskim', true);
            }
            if (this.array.options.config.plugin(pluginName).doNoViglinksForDomain(this.array.options.config, urlP.hostname)) {
                akasha.linkRelSetAttr($link, 'norewrite', true);
            }
        }

        return Promise.resolve("");
    }
}

class AffiliateProductContent extends mahabhuta.CustomElement {
    get elementName() { return "affiliate-product"; }
    async process($element, metadata, dirty) {
        const template = $element.attr('template') 
                ? $element.attr('template')
                : "affiliate-product.html.ejs";
        const productid = $element.attr('productid');
        const href = $element.attr('href');
        const data = this.array.options.config.plugin(pluginName)
                                .getProductData(href, productid);
        // const data = await getProductData(metadata, this.array.options.config, href, productid);
        if (!data) {
            throw new Error(`affiliate-product: No data found for ${productid} in ${metadata.document.path}`);
        }
        if (!data.productname) {
            throw new Error(`${pluginName} no product name for ${productid} in ${metadata.document.path} ${util.inspect(data)}`);
        }
        // Ensure there is a productlinks array
        if (!data.productlinks) {
            data.productlinks = [];
        }
        if (data.code && !data.anchorName) {
            data.anchorName = data.code;
        }
        // console.log(data);
        const buyurl = data.productbuyurl;
        // console.log(buyurl);
        // data.productbuyurl = undefined;
        try {
            const buyURL_p = new URL(buyurl);
            // Push productbuyurl to productlinks
            data.productlinks.unshift({
                url: buyurl,
                text: buyURL_p.hostname,
                tooltip: `Buy ${data.productname}`,
                rel: data.productrel
            });
        } catch (e) {
            console.error(`affiliate-product WARNING productbuyurl ${buyurl} invalid for productid ${productid}`);
            data.productbuyurl = buyurl;
        }
        data.partialBody = $element.html();
        dirty();
        return akasha.partial(this.array.options.config, template, data);
    }
}

class AffiliateProductAccordionContent extends mahabhuta.CustomElement {
    get elementName() { return "affiliate-product-accordion"; }
    async process($element, metadata, dirty) {
        const template = $element.attr('template') 
                ? $element.attr('template')
                : "affiliate-product-accordion.html.ejs";
        const id = $element.attr('id');
        if (!id || id === '') {
            throw new Error(`affiliate-product-accordion 'id' is required in ${metadata.document.path}`);
        }
        const productids = $element.data('products');
        if (!productids || productids === '' || !Array.isArray(productids)) {
            throw new Error(`affiliate-product-accordion 'data-products' is required in ${metadata.document.path}`);
        }
        const thumbImageStyle = $element.attr('thumb-image-style');
        if (!thumbImageStyle || thumbImageStyle === '') {
            throw new Error(`affiliate-product-accordion 'thumb-image-style' is required in ${metadata.document.path}`);
        }
        const href = $element.attr('href');
        const data = {
            id,
            usefade: "fade",
            thumbImageStyle,
            producthref: href
        };
        data.products = this.array.options.config.plugin(pluginName)
                                .getProductList(href, productid);
        // data.products = await getProductList(metadata, this.array.options.config, href, productids);
        if (!data.products || data.products.length <= 0) {
            throw new Error(`affiliate-product-accordion: No data found for ${util.inspect(productids)} in ${metadata.document.path}`);
        }
        data.products[0].isactive = "show active";
        // console.log(`affiliate-product-accordion ${id} ${util.inspect(data)}`);
        dirty();
        return akasha.partial(this.array.options.config, template, data);
    }
}

class AffiliateProductTableContent extends mahabhuta.CustomElement {
    get elementName() { return "affiliate-product-table"; }
    async process($element, metadata, dirty) {
        const template = $element.attr('template') 
                ? $element.attr('template')
                : "affiliate-product-tabbed-table.html.ejs";
        const id = $element.attr('id');
        if (!id || id === '') {
            throw new Error(`affiliate-product-table 'id' is required in ${metadata.document.path}`);
        }
        const productids = $element.data('products');
        if (!productids || productids === '' || !Array.isArray(productids)) {
            throw new Error(`affiliate-product-table 'data-products' is required in ${metadata.document.path}`);
        }
        const thumbImageStyle = $element.attr('thumb-image-style');
        if (!thumbImageStyle || thumbImageStyle === '') {
            throw new Error(`affiliate-product-table 'thumb-image-style' is required in ${metadata.document.path}`);
        }
        const href = $element.attr('href');
        const data = {
            id,
            usefade: "fade",
            thumbImageStyle
        };
        data.products = this.array.options.config.plugin(pluginName)
                                .getProductList(href, productid);
        // data.products = await getProductList(metadata, this.array.options.config, href, productids);
        if (!data.products || data.products.length <= 0) {
            throw new Error(`affiliate-product-table: No data found for ${util.inspect(productids)} in ${metadata.document.path}`);
        }
        data.products[0].isactive = "show active";
        // console.log(`affiliate-product-table ${id} ${util.inspect(data)}`);
        dirty();
        return akasha.partial(this.array.options.config, template, data);
    }
}

class AffiliateProductLink extends mahabhuta.CustomElement {
    get elementName() { return "affiliate-product-link"; }
    async process($element, metadata, dirty) {
        const productid = $element.attr('productid');
        const type   = $element.attr('type')   ? $element.attr('type')   : 'card';
        const float  = $element.attr('float')  ? $element.attr('float')  : "left";
        const width  = $element.attr('width')  ? $element.attr('width')  : "200px";
        const height = $element.attr('height') ? $element.attr('height') : "100%";
        const style  = $element.attr('style')  ? $element.attr('style')  : "width: 100%;";
        const template = $element.attr('template') 
                ? $element.attr('template') 
                : "affiliate-product-link-card.html.ejs"; 
        const docaption = $element.attr('docaption')
                ? $element.attr('docaption')
                : "true";
        let href = $element.attr('href');
        const isdirtyattr = $element.attr('dirty');
        
        /* WTF?  The href passed to getProductData is
         * there to support a document where products are
         * listed in the metadata.  It does not make sense
         * to substitute an href if one was not given in
         * the custom tag.  This substitution is for the
         * current document, but we do not know if this
         * document has any products, nor do we know if the
         * document lists the given document.  It's better
         * if the user of this custom tag explicitly give
         * the href if desired.
         *
         * In every other custom tag, there is no
         * substitution for the href value if none is
         * explicitly given in the custom tag.
         *
        if (!href) {
            href = '/' + metadata.document.renderTo;
        }
        */

        const data = this.array.options.config.plugin(pluginName)
                                .getProductData(href, productid);
        // const data = await getProductData(metadata, this.array.options.config, href, productid);
        if (!data) {
            throw new Error(`affiliate-product: No product data found for ${productid} in ${metadata.document.path}`);
        }
        var productHref = href;
        if (data.anchorName) productHref += '#' + data.anchorName;
        const productdescription = data.productdescription;

        if (type === "card") {
            // The templates for this which I've reviewed are not worthy of
            // requiring the <code>dirty</code> flag.  However, there might be
            // templates for which this is appropriate.
            //
            // Therefore the user of the element is required to set
            // the <code>isdirty</code> flag.
            if (isdirtyattr) dirty();
            return akasha.partial(this.array.options.config, template, {
                productid: productid, href: productHref,
                title: data.productname, thumburl: data.productimgurl,
                productbuyurl: data.productbuyurl,
                productdescription,
                content: $element.contents(),
                float: float, docaption: docaption,
                width: width, height: height,
                style: style
            });
        } else if (type === "link") {
            return `<a href='${productHref}'>${data.productname}</a>`;
        } else if (type === "teaser") {
            return `<a href='${productHref}'>${data.productname}</a>: ${data.teaser ? data.teaser : ''}`;
        }
    }
}

class AmazonBuyButtonElement extends mahabhuta.CustomElement {
    get elementName() { throw new Error("Use a subclass"); }
    process($element, metadata, dirty) {

        const asin     = $element.attr('asin');
        const display  = $element.attr('display');
        const affcode  = $element.attr('affcode')
                ? $element.attr('affcode')
                : this.array.options.amazonAffiliateCode[this.countryCode];
        const target   = $element.attr('target')
                ? $element.attr('target')
                : "_blank";
        const template = $element.attr('template')
                ? $element.attr('template')
                : this.defaultTemplate;

        if (!asin) {
            throw new Error(`${this.elementName()}: No ASIN found in ${metadata.document.path}`);
        }

        if (affcode && template) {
            return akasha.partial(this.array.options.config, template, {
                    targetBlank: target ? (` target="${target}"`) : "",
                    formDisplay: display ? (` style="display: ${display}" !important;`) : "",
                    ASIN: asin,
                    affcode: affcode
                });
        } else {
            return Promise.resolve("");
        }
    }

    get defaultTemplate() { throw new Error("Must subclass"); }
    get countryCode() { throw new Error("Must subclass"); }
}

// TBD: amazon-com-au-buy
// TBD: amazon-br-buy

class AmazonCABuyButtonElement extends AmazonBuyButtonElement {
    get elementName() { return "amazon-ca-buy"; }
    get defaultTemplate() { return "amazon-ca-buy.html.ejs"; }
    get countryCode() { return "ca"; }
}

// TBD: amazon-cn-buy

class AmazonJPBuyButtonElement extends AmazonBuyButtonElement {
    get elementName() { return "amazon-co-jp-buy"; }
    get defaultTemplate() { return "amazon-co-jp-buy.html.ejs"; }
    get countryCode() { return "co-jp"; }
}

class AmazonUKBuyButtonElement extends AmazonBuyButtonElement {
    get elementName() { return "amazon-co-uk-buy"; }
    get defaultTemplate() { return "amazon-co-uk-buy.html.ejs"; }
    get countryCode() { return "co-uk"; }
}

class AmazonUSABuyButtonElement extends AmazonBuyButtonElement {
    get elementName() { return "amazon-com-buy"; }
    get defaultTemplate() { return "amazon-com-buy.html.ejs"; }
    get countryCode() { return "com"; }
}

class AmazonDEBuyButtonElement extends AmazonBuyButtonElement {
    get elementName() { return "amazon-de-buy"; }
    get defaultTemplate() { return "amazon-de-buy.html.ejs"; }
    get countryCode() { return "de"; }
}

class AmazonESBuyButtonElement extends AmazonBuyButtonElement {
    get elementName() { return "amazon-es-buy"; }
    get defaultTemplate() { return "amazon-es-buy.html.ejs"; }
    get countryCode() { return "es"; }
}

class AmazonFRBuyButtonElement extends AmazonBuyButtonElement {
    get elementName() { return "amazon-fr-buy"; }
    get defaultTemplate() { return "amazon-fr-buy.html.ejs"; }
    get countryCode() { return "fr"; }
}

// TBD amazon-in-buy

class AmazonITBuyButtonElement extends AmazonBuyButtonElement {
    get elementName() { return "amazon-it-buy"; }
    get defaultTemplate() { return "amazon-it-buy.html.ejs"; }
    get countryCode() { return "it"; }
}

// TBD: amazon-mx-buy
