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

const pluginName = "@akashacms/plugins-affiliates";

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
        config.addLayoutsDir(path.join(__dirname, 'layouts'));
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

    // This is called from the Configuration file, telling us
    // a file from which to load products.  At the time this is
    // called the caches are not set up.  What we do is to push
    // the file name into this array, then in onPluginCacheSetup we
    // step through the array to read the files.
    loadAffiliateProducts(config, yamlFile) {
        this[_plugin_data_files].push(yamlFile);
        return this;
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
        // console.log(`getProductData ${_href} ${productid}`);
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
        // console.log(`getProductData ${util.inspect(selector)}`, found[0]);
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

    // Construct a productlinks array making sure to synthesize
    // an entry based on the links and information in
    // the product object.
    productLinks(product) {
        const ret = [];
        try {
            const buyURL_p = new URL(product.productbuyurl);
            const topush = {
                url: product.productbuyurl,
                text: buyURL_p.hostname,
                tooltip: `Buy ${product.productname}`,
                rel: product.productrel
            };
            // If the above executed correctly then we can
            // push the object.  If something went wrong
            // we'll instead pop into the catch block.
            ret.push(topush);
        } catch (e) {
            // Something failed, such as productbuyurl
            // cannot be parsed
            // IGNORE ERROR
        }
        if (product.productlinks) {
            for (let topush of product.productlinks) {
                ret.push(topush);
            }
        }
        return ret;
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
        const plugin = this.array.options.config.plugin(pluginName);
        if (!plugin) throw new Error(`AffiliateLinkMunger did not find plugin ${pluginName}`);
        let href     = $link.attr('href');
        let rel      = $link.attr('rel');

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
                let amazonCode = plugin
                        .amazonCodeForCountry(this.array.options.config, amazonSite.country);
                // console.log(`${urlP.hostname} is ${amazonSite.domain}? ${amazonSite.domain.test(urlP.hostname)} amazonCode ${amazonCode}`);
                if (domainMatch(amazonSite.domain, href)
                 && amazonCode) {
                    akasha.linkRelSetAttr($link, 'nofollow', true);
                    $link.attr('href', setAmazonAffiliateTag(href, amazonCode));
                    // console.log(`set href ${$link.attr('href')} rel ${$link.attr('rel')}`);
                }
            });

            if (plugin.doNoSkimlinksForDomain(this.array.options.config, urlP.hostname)) {
                akasha.linkRelSetAttr($link, 'noskim', true);
            }
            if (plugin.doNoViglinksForDomain(this.array.options.config, urlP.hostname)) {
                akasha.linkRelSetAttr($link, 'norewrite', true);
            }
        }

        return Promise.resolve("");
    }
}

class AffiliateProductContent extends mahabhuta.CustomElement {
    get elementName() { return "affiliate-product"; }
    async process($element, metadata, dirty) {
        const plugin = this.array.options.config.plugin(pluginName);
        const template = $element.attr('template') 
                ? $element.attr('template')
                : "affiliate-product.html.njk";
        const productid = $element.attr('productid');
        const href = $element.attr('href');
        const data = plugin.getProductData(href, productid);
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
        data.productlinks = plugin.productLinks(data);
        data.partialBody = $element.html();
        // The default template has several custom elements
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
        // console.log($element.attr('products'));
        // console.log($element.attr('data-products'));
        const productids = $element.data('products');
        // console.log(productids);
        // console.log(Array.isArray(productids));
        // console.log(typeof productids);
        if (!productids || productids === '' || !Array.isArray(productids)) {
            throw new Error(`affiliate-product-accordion 'data-products' is required in ${metadata.document.path}`);
        }
        /* const thumbImageStyle = $element.attr('thumb-image-style');
        if (!thumbImageStyle || thumbImageStyle === '') {
            throw new Error(`affiliate-product-accordion 'thumb-image-style' is required in ${metadata.document.path}`);
        } */
        const href = $element.attr('href');
        const data = {
            id,
            usefade: "fade",
            // thumbImageStyle,
            producthref: href
        };
        data.products = this.array.options.config.plugin(pluginName)
                                .getProductList(href, productids);
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
                                .getProductList(href, productids);
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
        const title  = $element.attr('title')  ? $element.attr('title')  : undefined;
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
        
        // Make sure to not use an href in this search so it will find
        // the productid wherever it's located
        const data = this.array.options.config.plugin(pluginName)
                                .getProductData(undefined, productid);
        if (!data) {
            throw new Error(`affiliate-product: No product data found for ${productid} in ${metadata.document.path}`);
        }
        // Construct actual href for product, using the anchor.
        // If no href specified in element, use the relative URL of the current page.
        var productHref = !href ? ('/' + metadata.document.renderTo) : href;
        if (data.anchorName) productHref += '#' + data.anchorName;

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
                title: title ? title : data.productname, thumburl: data.productimgurl,
                productbuyurl: data.productbuyurl,
                productdescription: data.productdescription,
                content: $element.contents(),
                float: float, docaption: docaption,
                width: width, height: height,
                style: style
            });
        } else if (type === "link") {
            return `<a href='${productHref}'>${title ? title : data.productname}</a>`;
        } else if (type === "teaser") {
            return `<a href='${productHref}'>${title ? title : data.productname}</a>: ${data.teaser ? data.teaser : ''}`;
        }
    }
}

/* This is an interesting idea but in practice doesn't work.  The issue is how to
 * specify a useful selector as the body of an element.
 *
 * This was tried:
 *
 *   <affiliate-select template-outer="select-container.html.ejs" template-item="select-item.html.ejs">
 *   { "productname": /P4460/ }
 *   </affiliate-select>
 *
 * That is, use a Regular Expression to select product names.  But this
 * just threw a syntax error in JSON.parse, because JSON.parse doesn't
 * understand regular expressions.  Hardcoding the selector as shown below
 * did produce the expected result, but it's not useful if we cannot do this
 * in the code.
 *
class AffiliateSelectElement extends mahabhuta.CustomElement {
    get elementName() { return "affiliate-select"; }
    async process($element, metadata, dirty) {
        const outerTemplate =  $element.attr('template-outer');
        const itemTemplate =  $element.attr('template-item');
        const clazz  = $element.attr('class');
        const id = $element.attr('id');
        const _selector = $element.text();

        if (!outerTemplate) {
            throw new Error(`affiliate-select no outerTemplate in ${metadata.document.path}`);
        }
        if (!itemTemplate) {
            throw new Error(`affiliate-select no itemTemplate in ${metadata.document.path}`);
        }
        if (!_selector) {
            throw new Error(`affiliate-select no _selector in ${metadata.document.path}`);
        }

        console.log(`affiliate-select _selector `, _selector);

        // const selector = JSON.parse(_selector);
        // console.log(`affiliate-select selector `, selector);
        const products = this.array.options.config.plugin(pluginName)
                                .select({ "productname": /P4460/ });
        console.log(`affiliate-select products ${products.length} `);
        const rendered = [];
        for (let product of products) {
            rendered.push(await akasha.partial(this.array.options.config, itemTemplate, product));
        }

        return await akasha.partial(this.array.options.config, outerTemplate, {
            class: clazz, id, products: rendered
        });
    }
}
*/

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

        // console.log(`AmazonBuyButtonElement ${asin} ${this.countryCode} ${affcode} ${template}`);

        if (affcode && template) {
            return akasha.partial(this.array.options.config, template, {
                    targetBlank: target ? (` target="${target}"`) : "",
                    formDisplay: display ? (` style="display: ${display}" !important;`) : "",
                    ASIN: asin,
                    affcode: affcode,
                    countryCode: this.countryCode
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
    // get defaultTemplate() { return "amazon-ca-buy.html.ejs"; }
    get defaultTemplate() { return "amazon-buy-button.html.njk"; }
    get countryCode() { return "ca"; }
}

// TBD: amazon-cn-buy

class AmazonJPBuyButtonElement extends AmazonBuyButtonElement {
    get elementName() { return "amazon-co-jp-buy"; }
    // get defaultTemplate() { return "amazon-co-jp-buy.html.ejs"; }
    get defaultTemplate() { return "amazon-buy-button.html.njk"; }
    get countryCode() { return "co-jp"; }
}

class AmazonUKBuyButtonElement extends AmazonBuyButtonElement {
    get elementName() { return "amazon-co-uk-buy"; }
    // get defaultTemplate() { return "amazon-co-uk-buy.html.ejs"; }
    get defaultTemplate() { return "amazon-buy-button.html.njk"; }
    get countryCode() { return "co-uk"; }
}

class AmazonUSABuyButtonElement extends AmazonBuyButtonElement {
    get elementName() { return "amazon-com-buy"; }
    // get defaultTemplate() { return "amazon-com-buy.html.ejs"; }
    get defaultTemplate() { return "amazon-buy-button.html.njk"; }
    get countryCode() { return "com"; }
}

class AmazonDEBuyButtonElement extends AmazonBuyButtonElement {
    get elementName() { return "amazon-de-buy"; }
    // get defaultTemplate() { return "amazon-de-buy.html.ejs"; }
    get defaultTemplate() { return "amazon-buy-button.html.njk"; }
    get countryCode() { return "de"; }
}

class AmazonESBuyButtonElement extends AmazonBuyButtonElement {
    get elementName() { return "amazon-es-buy"; }
    // get defaultTemplate() { return "amazon-es-buy.html.ejs"; }
    get defaultTemplate() { return "amazon-buy-button.html.njk"; }
    get countryCode() { return "es"; }
}

class AmazonFRBuyButtonElement extends AmazonBuyButtonElement {
    get elementName() { return "amazon-fr-buy"; }
    // get defaultTemplate() { return "amazon-fr-buy.html.ejs"; }
    get defaultTemplate() { return "amazon-buy-button.html.njk"; }
    get countryCode() { return "fr"; }
}

// TBD amazon-in-buy

class AmazonITBuyButtonElement extends AmazonBuyButtonElement {
    get elementName() { return "amazon-it-buy"; }
    // get defaultTemplate() { return "amazon-it-buy.html.ejs"; }
    get defaultTemplate() { return "amazon-buy-button.html.njk"; }
    get countryCode() { return "it"; }
}

// TBD: amazon-mx-buy
