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

const fs        = require('fs');
const url       = require('url');
const URL       = url.URL;
const path      = require('path');
const util      = require('util');
const akasha    = require('akasharender');
const mahabhuta = akasha.mahabhuta;
const yaml      = require('js-yaml');
const domainMatch = require('domain-match');

const pluginName = "akashacms-affiliates";

const _plugin_config = Symbol('config');
const _plugin_options = Symbol('options');

module.exports = class AdblockCheckerPlugin extends akasha.Plugin {
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
        options.products = [];
        options.amazonAffiliateCode = [];
        options.noSkimlinks = [];
        options.noViglinks = [];
    }

    get config() { return this[_plugin_config]; }
    get options() { return this[_plugin_options]; }

    affiliateProduct(config, productid, data) {
        if (data.productamzn) {
            data.productamzn = data.productamzn.map(item => {
                item.affcode = this.options.amazonAffiliateCode[item.countryCode];
                return item;
            });
        }
        this.options.products[productid] = data;
        return this;
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

    loadAffiliateProducts(config, yamlFile) {
        var doc = yaml.safeLoad(fs.readFileSync(yamlFile, 'utf8'));
        for (var product of doc.products) {
            this.affiliateProduct(config, product.code, product);
        }
        return this;
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

async function getProductData(metadata, config, href, productid) {
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
        products = this.options.products;
    }
    if (productid) {
        for (let product of products) {
            if (product.code === productid) {
                data = product;
                break;
            }
        }
    } else {
        data = products[Math.floor(Math.random() * products.length)];
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

async function getProductList(metadata, config, href, productids) {
    let ret = [];
    for (let productid of productids) {
        ret.push(await getProductData(metadata, config, href, productid));
    }
    return ret;
}

module.exports.mahabhutaArray = function(options) {
    let ret = new mahabhuta.MahafuncArray(pluginName, options);
    ret.addMahafunc(new AffiliateLinkMunger());
    ret.addMahafunc(new AffiliateProductContent());
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
                { country: "com", domain: '*.amazon.com' /* /amazon\.com$/i */ },
                { country: "ca",  domain: '*.amazon.ca' /* /amazon\.ca$/i */ },
                { country: "co-jp",  domain: '*.amazon.co.jp' /* /amazon\.co\.jp$/i */ },
                { country: "co-uk",  domain: '*.amazon.co.uk' /* /amazon\.co\.uk$/i */ },
                { country: "de",  domain: '*.amazon.de' /* /amazon\.de$/i */ },
                { country: "es",  domain: '*.amazon.es' /* /amazon\.es$/i */ },
                { country: "fr",  domain: '*.amazon.fr' /* /amazon\.fr$/i */ },
                { country: "it",  domain: '*.amazon.it' /* /amazon\.it$/i */ }
            ].forEach(amazonSite => {
                let amazonCode = this.array.options.config.plugin(pluginName)
                        .amazonCodeForCountry(this.array.options.config, amazonSite.country);
                // console.log(`${urlP.hostname} is ${amazonSite.domain}? ${amazonSite.domain.test(urlP.hostname)} amazonCode ${amazonCode}`);
                if (domainMatch(amazonSite.domain, href) /* amazonSite.domain.test(urlP.hostname) */ && amazonCode) {
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
        const data = await getProductData(metadata, this.array.options.config, href, productid);
        if (!data) {
            throw new Error(`affiliate-product: No data found for ${productid} in ${metadata.document.path}`);
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
        data.productbuyurl = undefined;
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
        // dirty();
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
        /* data.products = productids.map((productid) => {
            return {
                id: productid, href
            };
        }); */
        data.products = await getProductList(metadata, this.array.options.config, href, productids);
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
        data.products = await getProductList(metadata, this.array.options.config, href, productids);
        if (!data.products || data.products.length <= 0) {
            throw new Error(`affiliate-product-table: No data found for ${util.inspect(productids)} in ${metadata.document.path}`);
        }
        data.products[0].isactive = "show active";
        // console.log(`affiliate-product-table ${id} ${util.inspect(data)}`);
        // dirty();
        return akasha.partial(this.array.options.config, template, data);
    }
}

class AffiliateProductLink extends mahabhuta.CustomElement {
    get elementName() { return "affiliate-product-link"; }
    async process($element, metadata, dirty) {
        const productid = $element.attr('productid');
        const type = $element.attr('type') 
                ? $element.attr('type') 
                : 'card';
        const float = $element.attr('float')
                ? $element.attr('float')
                : "left";
        const width = $element.attr('width')
                ? $element.attr('width')
                : "200px";
        const height = $element.attr('height')
                ? $element.attr('height')
                : "100%";
        const style = $element.attr('style')
                ? $element.attr('style')
                : "width: 100%;";
        const template = $element.attr('template') 
                ? $element.attr('template') 
                : "affiliate-product-link-card.html.ejs"; 
        let href = $element.attr('href');
        const docaption = $element.attr('docaption')
                ? $element.attr('docaption')
                : "true";
        
        if (!href) {
            href = '/' + metadata.document.renderTo;
        }

        const data = await getProductData(metadata, this.array.options.config, href, productid);
        if (!data) {
            throw new Error(`affiliate-product: No product data found for ${productid} in ${metadata.document.path}`);
        }
        var productHref = href;
        if (data.anchorName) productHref += '#' + data.anchorName;
        const productdescription = data.productdescription;

        if (type === "card") {
            dirty();
            return akasha.partial(this.array.options.config, template, {
                productid: productid, href: productHref,
                title: data.productname, thumburl: data.productimgurl,
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
