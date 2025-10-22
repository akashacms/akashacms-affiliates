/**
 *
 * Copyright 2017, 2018, 2019, 2024, 2025 David Herron
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

import { promises as fsp } from 'node:fs';
import { URL } from 'node:url';
import path from 'node:path';
import util from 'node:util';
import akasha from 'akasharender';
import {
    Configuration,
    CustomElement,
    Munger,
    PageProcessor
} from 'akasharender';
const mahabhuta = akasha.mahabhuta;
import yaml from 'js-yaml';
import domainMatch from 'domain-match';
import { newSQ3DataStore } from 'akasharender/dist/sqdb.js';

const __dirname = import.meta.dirname;

const pluginName = "@akashacms/plugins-affiliates";

var sq3db;

export class AffiliatesPlugin extends akasha.Plugin {

    #config;
    #data_files;

    constructor() {
        super(pluginName);
    }

    configure(config, options) {
        this.#config = config;
        // this.config = config;
        this.akasha = config.akasha;
        this.options = options ? options : {};
        this.options.config = config;
        config.addPartialsDir(path.join(__dirname, 'partials'));
        config.addLayoutsDir(path.join(__dirname, 'layouts'));
        config.addAssetsDir({
            src: path.join(__dirname, 'buy-images'),
            dest: 'vendor/@akashacms/plugin-affiliates'
        });
        config.addMahabhuta(mahabhutaArray(options, config, this.akasha, this));
        // options.products = new Map(); // []; -- No longer needed
        options.amazonAffiliateCode = [];
        options.noSkimlinks = [];
        options.noViglinks = [];
        this.#data_files = [];

        sq3db = newSQ3DataStore('affiliates');

    }

    get config() { return this.#config; }

    // Ensure the cache is set up
    async onPluginCacheSetup() {
        // console.log(`onPluginCacheSetup`);

        for (let datafile of this.#data_files) {
            const doc = yaml.safeLoad(await fsp.readFile(datafile, 'utf8'));
            for (let product of doc.products) {
                if (!product) {
                    throw new Error(`Undefined product found in ${yamlFile}`);
                }
                if (!product.code) {
                    throw new Error(`No product code supplied in ${util.inspect(product)}`);
                }
                await this.affiliateProduct(this.config, product.code, product);
            }
        }
    }

    async getProductByCode(productid) {
        let found;
        try {
            found = await sq3db.get(productid);
        } catch (err) {
            console.warn(`getProductByCode ERROR ${err.message}`, found);
        }
        // console.log(`getProductByCode ${productid} found=`, found);

        if (!found) return undefined;

        return found;
    }

    async deleteProductByCode(productid) {
        await sq3db.remove(productid);
    }

    async affiliateProduct(config, productid, data) {
        if (data.productamzn) {
            data.productamzn = data.productamzn.map(item => {
                item.affcode = this.options.amazonAffiliateCode[item.countryCode];
                return item;
            });
        }
        // console.log(`affiliateProduct adding ${data.code} ${data.productname}`, data);
        const result = await sq3db.put(productid, data);

        // console.log(`affiliateProduct after adding ${data.code} result=`, result);
    }

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
        this.#data_files.push(yamlFile);
        return this;
    }

    async filterProducts(searchFN) {
        const products = await sq3db.findAll();
        // console.log(`filterProducts `, products);
        //
        // This returns an object with a rows field
        // containing descriptors of the documents, plus
        // some spurious entries whose `id` starts
        // with _design/
        //
        // We eliminate the later, then pull out the
        // 'doc' field because that's the desired data.
        return products
            .filter(searchFN);
    }

    // These two hook functions automatically incorporate
    // affiliate product data from any document that has
    // such metadata

    async onFileAdded(config, collection, vpinfo) {
        // console.log(`onFileAdded ${vpinfo?.vpath}`, vpinfo?.docMetadata?.products);
        if (vpinfo.docMetadata
         && vpinfo.docMetadata.products
         && Array.isArray(vpinfo.docMetadata.products)) {
            for (let product of vpinfo.docMetadata.products) {
                // if (!(product.doc)) product.doc = {};
                product.doc_vpath = vpinfo.vpath;
                product.doc_renderPath = vpinfo.renderPath;
                try {
                    await this.affiliateProduct(config, product.code, product);
                } catch (err) {
                    console.warn(`onFileAdded caught error for ${util.inspect(product)}`, err.stack);
                }
            }
        }
    }

    async onFileChanged(config, collection, vpinfo) {
        // console.log(`onFileChanged ${vpinfo.vpath}`, vpinfo.docMetadata.products);
        if (vpinfo.docMetadata
         && vpinfo.docMetadata.products
         && Array.isArray(vpinfo.docMetadata.products)) {
            for (let product of vpinfo.docMetadata.products) {
                if (!(product.doc)) product.doc = {};
                product.doc.vpath = vpinfo.vpath;
                product.doc.renderPath = vpinfo.renderPath;
                try {
                    await this.affiliateProduct(config, product.code, product);
                } catch (err) {
                    console.warn(`onFileChanged caught error for ${util.inspect(product)}`, err.stack);
                }
            }
        }
    }

    // This hook function automatically removes any
    // affiliate product data corresponding to the
    // document which has been removed

    async onFileUnlinked(config, collection, vpinfo) {
        const found = await sq3db.find({
            '$.doc_vpath': { '$eq': vpinfo.vpath }
        });
        for (const f in found) {
            await sq3db.remove(f);
        }
    }

    async select(selector) {
        // const coll = this.getCache();
        const found = await sq3db.find({ selector });
        if (!found) return undefined;
        if (!Array.isArray(found)) return undefined;
        if (found.length <= 0) return undefined;
        return found;
    }

    async getProductData(_href, productid) {
        // console.log(`getProductData ${_href} ${productid}`);
        let href;
        if (_href) {
            href = _href.startsWith('/')
                    ? _href.substring(1)
                    : _href;
        } else {
            href = undefined;
        }
        if (!productid && href) {
            return this.getRandomProduct(href);
        }
        if (productid && !href) {
            return this.getProductByCode(productid);
        }
        if (!href && !productid) {
            // Instead of throwing an error, look further
            // afield for a random product.  The method
            // already handles this case.
            return this.getRandomProduct(undefined);
            // throw new Error(`getProductData must have href and/or productid, had neither`);
        }
        const selector = {
            '$.code': productid,
            '$or': [
                { '$.doc_vpath': href },
                { '$.doc_renderPath': href }
            ]
        };
        // console.log(`getProductData selector ${yaml.dump({ selector }, { indent: 4 })}`)
        // const found = await this.select(selector);
        const found = await sq3db.find(selector);
        if (!found
         || !(Array.isArray(found))
         || found.length <= 0
        ) {
            console.log(`getProductData failed to find anything for ${productid} ${href} ${JSON.stringify(selector)}`, found);
            // console.log(filecache.documents.find(href));
            return undefined;
        }
        // console.log(`getProductData ${util.inspect(selector)}`, found);
        return found[0];
    }

    async getProductList(_href, productids) {
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
            ret.push(await this.getProductData(href, productid));
        }
        return ret;
    }

    async getRandomProduct(_href) {
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
                { '$.doc_vpath': href },
                { '$.doc_renderPath': href }
            ];
        }
        // console.log(`getRandomProduct selector `, selector);
        const found = await sq3db.find(selector);
        if (!found
         || !Array.isArray(found)
         || found.length <= 0
        ) {
            // console.log(`getRandomProduct found nothing returning undefined`);
            return undefined;
        } else {
            const ret = found[
                Math.floor(Math.random() * found.length)
            ];
            // console.log(`getRandomProduct returning `, ret);
            return ret;
        }
    }

    async getAllProducts() {
        const ret = await sq3db.findAll();
        return ret;
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
    const urlP = new URL(href, 'http://example.com');
    urlP.searchParams.set('tag', tag);
    return urlP.toString();
}

export function mahabhutaArray(
    options,
    config, // ?: Configuration,
    akasha, // ?: any,
    plugin  // ?: Plugin
) {
    let ret = new mahabhuta.MahafuncArray(pluginName, options);
    ret.addMahafunc(new AffiliateLinkMunger(config, akasha, plugin));
    ret.addMahafunc(new AffiliateProductContent(config, akasha, plugin));
    ret.addMahafunc(new AffiliateProductAccordionContent(config, akasha, plugin));
    ret.addMahafunc(new AffiliateProductTableContent(config, akasha, plugin));
    ret.addMahafunc(new AffiliateProductLink(config, akasha, plugin));
    ret.addMahafunc(new AmazonCABuyButtonElement(config, akasha, plugin));
    ret.addMahafunc(new AmazonJPBuyButtonElement(config, akasha, plugin));
    ret.addMahafunc(new AmazonUKBuyButtonElement(config, akasha, plugin));
    ret.addMahafunc(new AmazonUSABuyButtonElement(config, akasha, plugin));
    ret.addMahafunc(new AmazonDEBuyButtonElement(config, akasha, plugin));
    ret.addMahafunc(new AmazonESBuyButtonElement(config, akasha, plugin));
    ret.addMahafunc(new AmazonFRBuyButtonElement(config, akasha, plugin));
    ret.addMahafunc(new AmazonITBuyButtonElement(config, akasha, plugin));
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
class AffiliateLinkMunger extends Munger {
    get selector() { return "html body a"; }

    async process($, $link, metadata, dirty, done) {
        const plugin = this.config.plugin(pluginName);
        if (!plugin) throw new Error(`AffiliateLinkMunger did not find plugin ${pluginName}`);
        let href     = $link.attr('href');
        let rel      = $link.attr('rel');

        if (!href) return '';

        // We only act on the link if it is external
        const urlP = new URL(href, 'http://example.com');
        if (urlP.origin !== 'http://example.com') {

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
                        .amazonCodeForCountry(this.config, amazonSite.country);
                // console.log(`${urlP.hostname} is ${amazonSite.domain}? ${amazonSite.domain.test(urlP.hostname)} amazonCode ${amazonCode}`);
                if (domainMatch(amazonSite.domain, href)
                 && amazonCode) {
                    this.akasha.linkRelSetAttr($link, 'nofollow', true);
                    $link.attr('href', setAmazonAffiliateTag(href, amazonCode));
                    // console.log(`set href ${$link.attr('href')} rel ${$link.attr('rel')}`);
                }
            });

            if (plugin.doNoSkimlinksForDomain(this.array.options.config, urlP.hostname)) {
                this.akasha.linkRelSetAttr($link, 'noskim', true);
            }
            if (plugin.doNoViglinksForDomain(this.array.options.config, urlP.hostname)) {
                this.akasha.linkRelSetAttr($link, 'norewrite', true);
            }
        }

        return Promise.resolve("");
    }
}

class AffiliateProductContent extends CustomElement {
    get elementName() { return "affiliate-product"; }
    async process($element, metadata, dirty) {
        const plugin = this.config.plugin(pluginName);
        const template = $element.attr('template') 
                ? $element.attr('template')
                : "affiliate-product.html.njk";
        const productid = $element.attr('productid');
        const href = $element.attr('href');
        const parentID = $element.attr('parentid');
        const collapsed = $element.attr('collapsed')
                    ? $element.attr('collapsed')
                    : "false";
        if (collapsed !== 'true' && collapsed !== 'false') {
            throw new Error(`affiliate-product, collapsed must be 'true' or 'false', got ${util.inspect(collapsed)}`);
        }
        // console.log(`affiliate-data ${util.inspect(productid)} ${util.inspect(href)} ${util.inspect(metadata.document.path)}`);
        const data = await plugin.getProductData(href, productid);
        // const data = await getProductData(metadata, this.array.options.config, href, productid);
        if (!data) {
            console.warn(`affiliate-product: No data found for ${productid} in ${metadata.document.path}`);
            return '';
        }
        if (!data.productname) {
            console.warn(`${pluginName} no product name for ${productid} in ${metadata.document.path} ${util.inspect(data)}`);
            return '';
        }
        // Ensure there is a productlinks array
        if (!data.productlinks) {
            data.productlinks = [];
        }
        if (data.code && !data.anchorName) {
            data.anchorName = data.code;
        }
        data.parentID = parentID;
        data.collapsed = collapsed;
        // console.log(data);
        data.productlinks = plugin.productLinks(data);
        data.partialBody = $element.html();

        // console.log(`affiliate-product ${template} productid ${productid} - href ${href} - parentID ${parentID} `, data);
        // The default template has several custom elements
        dirty();
        return this.config.akasha.partial(this.config, template, data);
    }
}

class AffiliateProductAccordionContent extends CustomElement {
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
        data.products = await this.config.plugin(pluginName)
                                .getProductList(href, productids);
        // data.products = await getProductList(metadata, this.array.options.config, href, productids);
        if (!data.products || data.products.length <= 0) {
            console.warn(`affiliate-product-accordion: No data found for ${util.inspect(productids)} in ${metadata.document.path}`);
            return '';
        }
        data.products[0].isactive = "show active";
        // console.log(`affiliate-product-accordion ${id} ${util.inspect(data)}`);
        dirty();
        return this.akasha.partial(this.config, template, data);
    }
}

class AffiliateProductTableContent extends CustomElement {
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
        data.products = await this.config.plugin(pluginName)
                                .getProductList(href, productids);
        // data.products = await getProductList(metadata, this.array.options.config, href, productids);
        if (!data.products || data.products.length <= 0) {
            console.warn(`affiliate-product-table: No data found for ${util.inspect(productids)} in ${metadata.document.path}`);
            return '';
        }
        data.products[0].isactive = "show active";
        // console.log(`affiliate-product-table ${id} ${util.inspect(data)}`);
        dirty();
        return this.akasha.partial(this.config, template, data);
    }
}

class AffiliateProductLink extends CustomElement {
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
        let random = $element.attr('random');
        const isdirtyattr = $element.attr('dirty');

        let data;

        if (typeof random === 'string' && random === 'yes') {
            data = await this.config.plugin(pluginName)
                    .getRandomProduct(href);
        } else {
            // Make sure to not use an href in this search so it will find
            // the productid wherever it's located
            data = await this.config.plugin(pluginName)
                                    .getProductData(undefined, productid);
        }
        if (!data) {
            console.warn(`affiliate-product: No product data found for ${productid} in ${metadata.document.path}`);
            return '';
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
            return this.akasha.partial(this.config, template, {
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

class AmazonBuyButtonElement extends CustomElement {
    get elementName() { throw new Error("Use a subclass"); }
    async process($element, metadata, dirty) {

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
            return this.akasha.partial(this.config, template, {
                    targetBlank: target ? (` target="${target}"`) : "",
                    formDisplay: display ? (` style="display: ${display}" !important;`) : "",
                    ASIN: asin,
                    affcode: affcode,
                    countryCode: this.countryCode
                });
        } else {
            return '';
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
