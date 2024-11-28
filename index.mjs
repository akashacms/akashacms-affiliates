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

import { promises as fsp } from 'node:fs';
import url, { URL } from 'node:url';
import path from 'node:path';
import util from 'node:util';
import akasha from 'akasharender';
const mahabhuta = akasha.mahabhuta;
import yaml from 'js-yaml';
import domainMatch from 'domain-match';

// import { sqdb } from 'akasharender/dist/sqdb.js';
import { default as PouchDB } from 'pouchdb';
import { default as PouchDBFind } from 'pouchdb-find';
PouchDB.plugin(PouchDBFind);

const db = new PouchDB('affiliates');
db.createIndex({
    index: {
        fields: [ 'code' ],
        name: 'code',
        ddoc: 'code'
    }
});
db.createIndex({
    index: {
        fields: [ 'doc_vpath' ],
        name: 'doc_vpath',
        ddoc: 'doc_vpath'
    }
});
db.createIndex({
    index: {
        fields: [ 'doc_renderPath' ],
        name: 'doc_renderPath',
        ddoc: 'doc_renderPath'
    }
});

const __dirname = import.meta.dirname;

// console.log(`index.mjs `, db);

const pluginName = "@akashacms/plugins-affiliates";


export class AffiliatesPlugin extends akasha.Plugin {

    #config;
    #data_files;

    constructor() {
        super(pluginName);
    }

    configure(config, options) {
        this.#config = config;
        this.options = options;
        options.config = config;
        config.addPartialsDir(path.join(__dirname, 'partials'));
        config.addLayoutsDir(path.join(__dirname, 'layouts'));
        config.addAssetsDir({
            src: path.join(__dirname, 'buy-images'),
            dest: 'vendor/@akashacms/plugin-affiliates'
        });
        config.addMahabhuta(mahabhutaArray(options));
        // options.products = new Map(); // []; -- No longer needed
        options.amazonAffiliateCode = [];
        options.noSkimlinks = [];
        options.noViglinks = [];
        this.#data_files = [];

        // sqdb._db.run(`
        //     CREATE TABLE AFFILIATES (
        //         code TEXT,
        //         doc_vpath TEXT,
        //         doc_renderPath TEXT,
        //         anchorName TEXT,
        //         productname TEXT,
        //         productbuyurl TEXT,
        //         productimgurl TEXT,
        //         gallery TEXT,
        //         productrel TEXT,
        //         productdescription TEXT,
        //         productattributes JSON - TBD,
        //         productamzn JSON - TBD,
        //         amznassociatetag TEXT,
        //         productlinks JSON - TBD
        //     )    
        // `)
    }

    get config() { return this.#config; }

    // getProductByCode(productid)
    // let found = coll.find({
    //    code: { '$eq': productid }
    // });
    //
    // deleteProductByCode(productid)
    // coll.findAndRemove({
    //    code: { '$eq': productid }
    // });
    //
    // affiliateProduct(config, productid, data)
    // coll.insert(data);
    // These call affiliateProduct
    // onFileAdded(config, collection, vpinfo) {
    //
    // onFileUnlinked(config, collection, vpinfo) {
    // coll.findAndRemove({
    //    doc_vpath: { '$eq': vpinfo.vpath }
    // });
    //
    // filterProducts(searchFN) {
    // const products = this.getAllProducts().filter(searchFN);
    // onFileChanged(config, collection, vpinfo) {
    //
    // select(selector) {
    // const found = coll.find(selector);
    //
    // getProductData(_href, productid) {
    // if (!productid) return this.getRandomProduct(href);
    // const selector = {
    //    code: { '$eq': productid }
    // };
    // if (href) {
    //    selector['$or'] = [
    //        { doc_vpath: { '$eq': href } },
    //        { doc_renderPath: { '$eq': href } }
    //    ];
    // }
    // const found = this.select(selector);
    //
    // getProductList(_href, productids) {
    // for (let productid of productids) {
    //    ret.push(this.getProductData(href, productid));
    // }
    //
    // getAllProducts() {
    //    return this.select({});
    // }

    // getCache() {
    //     // Not needed for PouchDB
    //     // const coll = this.akasha.filecache.getCollection(pluginName);
    //     // if (!coll) {
    //     //     throw new Error(`${pluginName} getCache failed to getCache ${coll}`);
    //     // }
    //     // return coll;
    // }

    // Ensure the cache is set up
    async onPluginCacheSetup() {
        // console.log(`onPluginCacheSetup`);

        for (let datafile of this.#data_files) {
            const doc = yaml.safeLoad(await fsp.readFile(datafile, 'utf8'));
            // console.log(`onPluginCacheSetup loading ${doc.products.length} items from ${datafile}`, doc.products.map(prod => {
            //     return {
            //         datafile: datafile,
            //         code: prod.code,
            //         productname: prod.productname
            //     }
            // }));
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
        // const coll = this.getCache();
        // console.log(`getProductByCode ${productid}`);
        let found;
        try {
            found = await db.get(productid);
        } catch (err) {
            console.warn(`getProductByCode ERROR ${err.message}`);
        }
        // console.log(`getProductByCode ${productid} found=`, found);

        if (!found) return undefined;

        return found;
    }

    async deleteProductByCode(productid) {
        const doc = await db.get(productid);
        await db.remove(doc);
    }

    async affiliateProduct(config, productid, data) {
        let _data = await  this.getProductByCode(productid);
        if (_data) {
            await this.deleteProductByCode(productid);
        }
        if (data.productamzn) {
            data.productamzn = data.productamzn.map(item => {
                item.affcode = this.options.amazonAffiliateCode[item.countryCode];
                return item;
            });
        }
        // console.log(`affiliateProduct adding ${data.code} ${data.productname}`);
        // The code field is the primary index
        // For PouchDB this is _id
        data._id = data.code;
        const result = await db.put(data);

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
        const products = (await db.allDocs({
            include_docs: true,
            attachments: true
        }))
        // console.log(`filterProducts `, products);
        //
        // This returns an object with a rows field
        // containing descriptors of the documents, plus
        // some spurious entries whose `id` starts
        // with _design/
        //
        // We eliminate the later, then pull out the
        // 'doc' field because that's the desired data.
        return products.rows
            .filter(item => {
                return ! item.id.startsWith('_design/')
            })
            .map(item => {
                return item.doc;
            })
            .filter(searchFN);
    }

    // These two hook functions automatically incorporate
    // affiliate product data from any document that has
    // such metadata

    async onFileAdded(config, collection, vpinfo) {
        // console.log(`onFileAdded ${vpinfo.vpath}`, vpinfo.docMetadata.products);
        if (vpinfo.docMetadata
         && vpinfo.docMetadata.products
         && Array.isArray(vpinfo.docMetadata.products)) {
            for (let product of vpinfo.docMetadata.products) {
                // if (!(product.doc)) product.doc = {};
                product.doc_vpath = vpinfo.vpath;
                product.doc_renderPath = vpinfo.renderPath;
                await this.affiliateProduct(config, product.code, product);
            }
        }
    }

    async onFileChanged(config, collection, vpinfo) {
        console.log(`onFileChanged ${vpinfo.vpath}`, vpinfo.docMetadata.products);
        if (vpinfo.docMetadata
         && vpinfo.docMetadata.products
         && Array.isArray(vpinfo.docMetadata.products)) {
            for (let product of vpinfo.docMetadata.products) {
                if (!(product.doc)) product.doc = {};
                product.doc.vpath = vpinfo.vpath;
                product.doc.renderPath = vpinfo.renderPath;
                await this.affiliateProduct(config, product.code, product);
            }
        }
    }

    // This hook function automatically removes any
    // affiliate product data corresponding to the
    // document which has been removed

    async onFileUnlinked(config, collection, vpinfo) {
        // const coll = this.getCache();
        // coll.findAndRemove({
        //     doc_vpath: { '$eq': vpinfo.vpath }
        // });

        const founc = await db.find({
            selector: {
                doc_vpath: { '$eq': vpinfo.vpath }
            }
        });
        for (const f in found) {
            await db.remove(f);
        }
    }

    async select(selector) {
        // const coll = this.getCache();
        const found = await db.find({ selector });
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
            throw new Error(`getProductData must have href and/or productid, had neither`);
        }
        const selector = {
                code: productid,
                '$or': [
                    { doc_vpath: href },
                    { doc_renderPath: href }
                ]
        };
        // const found = await this.select(selector);
        const found = await db.find({
            selector
        });
        if (!found
         || !(typeof found === 'object')
         || !('docs' in found)
         || !(Array.isArray(found.docs))
         || found.docs.length <= 0
        ) {
            console.log(`getProductData failed to find anything for ${productid} ${href} ${JSON.stringify(selector)}`, found);
            // console.log(filecache.documents.find(href));
            return undefined;
        }
        // console.log(`getProductData ${util.inspect(selector)}`, found);
        return found.docs[0];
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
                { doc_vpath: { '$eq': href } },
                { doc_renderPath: { '$eq': href } }
            ];
        }
        const found = await this.select(selector);
        if (!found
         || !Array.isArray(found)
         || found.length <= 0
        ) {
            return undefined;
        } else {
            return found[
                Math.floor(Math.random() * found.length)
            ];
        }
    }

    async getAllProducts() {
        const ret = (await db.allDocs({
            include_docs: true,
            attachments: true
        }));
        // In the query I'm looking at, there
        // are three items of this nature:
        //    {
        //       id: '_design/doc_vpath',
        //       key: '_design/doc_vpath',
        //       value: { rev: '1-5a9153183639f667fe6021bea8b93df3' },
        //       doc: {
        //         language: 'query',
        //         views: [Object],
        //        _id: '_design/doc_vpath',
        //        _rev: '1-5a9153183639f667fe6021bea8b93df3'
        //       }
        //     }
        //
        // THis .filter section is to
        // eliminate such entries
        const ret2 = ret.rows.filter(item => {
            if ('language' in item.doc
             && item.doc.language === 'query'
            ) {
                return false;
            } else {
                return true;
            }
        });
        // The remaining items have this shape:
        //
        //      {
        //        id: 'efergy-elite-wireless-electricity-monitor',
        //        key: 'efergy-elite-wireless-electricity-monitor',
        //        value: { rev: '19-de9a1f2a2daed2ae829f7360f5355252' },
        //        doc: {
        //            ... The actual document
        //        }
        //      }
        //
        // This section converts it to an
        // array of the actual documents.
        const ret3 = ret2.map(item => {
            return item.doc;
        });
        return ret3;
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

export function mahabhutaArray(options) {
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

    async process($, $link, metadata, dirty, done) {
        const plugin = this.array.options.config.plugin(pluginName);
        if (!plugin) throw new Error(`AffiliateLinkMunger did not find plugin ${pluginName}`);
        let href     = $link.attr('href');
        let rel      = $link.attr('rel');

        if (!href) return '';

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
        const parentID = $element.attr('parentid')
        // console.log(`affiliate-data ${util.inspect(productid)} ${util.inspect(href)} ${util.inspect(metadata.document.path)}`);
        const data = await plugin.getProductData(href, productid);
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
        data.parentID = parentID;
        // console.log(data);
        data.productlinks = plugin.productLinks(data);
        data.partialBody = $element.html();
        // The default template has several custom elements
        dirty();
        return this.array.options.config.akasha.partial(this.array.options.config, template, data);
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
        data.products = await this.array.options.config.plugin(pluginName)
                                .getProductList(href, productids);
        // data.products = await getProductList(metadata, this.array.options.config, href, productids);
        if (!data.products || data.products.length <= 0) {
            throw new Error(`affiliate-product-accordion: No data found for ${util.inspect(productids)} in ${metadata.document.path}`);
        }
        data.products[0].isactive = "show active";
        // console.log(`affiliate-product-accordion ${id} ${util.inspect(data)}`);
        dirty();
        return this.array.options.config.akasha.partial(this.array.options.config, template, data);
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
        data.products = await this.array.options.config.plugin(pluginName)
                                .getProductList(href, productids);
        // data.products = await getProductList(metadata, this.array.options.config, href, productids);
        if (!data.products || data.products.length <= 0) {
            throw new Error(`affiliate-product-table: No data found for ${util.inspect(productids)} in ${metadata.document.path}`);
        }
        data.products[0].isactive = "show active";
        // console.log(`affiliate-product-table ${id} ${util.inspect(data)}`);
        dirty();
        return this.array.options.config.akasha.partial(this.array.options.config, template, data);
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
        const data = await this.array.options.config.plugin(pluginName)
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
            return this.array.options.config.akasha.partial(this.array.options.config, template, {
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

class AmazonBuyButtonElement extends mahabhuta.CustomElement {
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
            return this.array.options.config.akasha.partial(this.array.options.config, template, {
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
