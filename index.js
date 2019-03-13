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
const path      = require('path');
const util      = require('util');
const akasha    = require('akasharender');
const mahabhuta = akasha.mahabhuta;
const yaml      = require('js-yaml');
const domainMatch = require('domain-match');

// const log   = require('debug')('akasha:affiliates-plugin');
// const error = require('debug')('akasha:error-affiliates-plugin');

const pluginName = "akashacms-affiliates";

module.exports = class AdblockCheckerPlugin extends akasha.Plugin {
    constructor() {
        super(pluginName);
    }

    configure(config) {
        config.addPartialsDir(path.join(__dirname, 'partials'));
        config.addMahabhuta(module.exports.mahabhuta);
        config.pluginData(pluginName).products = [];
        config.pluginData(pluginName).amazonAffiliateCode = [];
        config.pluginData(pluginName).noSkimlinks = [];
        config.pluginData(pluginName).noViglinks = [];
    }

    affiliateProduct(config, productid, data) {
        if (data.productamzn) {
            data.productamzn = data.productamzn.map(item => {
                item.affcode = config.pluginData(pluginName).amazonAffiliateCode[item.countryCode];
                return item;
            });
        }
        config.pluginData(pluginName).products[productid] = data;
        return this;
    }

    amazonAffiliateCode(config, countryCode, amznCode) {
        config.pluginData(pluginName).amazonAffiliateCode[countryCode] = amznCode;
        return this;
    }

    amazonCodeForCountry(config, countryCode) {
        return config.pluginData(pluginName).amazonAffiliateCode[countryCode];
    }

    noSkimlinksDomain(config, domain) {
        config.pluginData(pluginName).noSkimlinks.push(domain);
        return this;
    }

    doNoSkimlinksForDomain(config, domain) {
        for (var noskimdnm of config.pluginData(pluginName).noSkimlinks) {
            if (domain.match(noskimdnm)) {
                return true;
            }
        }
        return false;
    }

    noViglinksDomain(config, domain) {
        config.pluginData(pluginName).noViglinks.push(domain);
        return this;
    }

    doNoViglinksForDomain(config, domain) {
        for (var novigdnm of config.pluginData(pluginName).noViglinks) {
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

async function getProductData(metadata, href, productid) {
    let data;
    let products;
    if (href) {
        let doc = await akasha.readDocument(metadata.config, href);
        if (doc && "products" in doc.metadata) {
            products = doc.metadata.products;
        }
    }
    if (!products && "products" in metadata) {
        products = metadata.products;
    }
    if (!products) {
        products = metadata.config.pluginData(pluginName).products;
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
    return data;
}

async function getProductList(metadata, href, productids) {
    let ret = [];
    for (let productid of productids) {
        ret.push(await getProductData(metadata, href, productid));
    }
    return ret;
}

module.exports.mahabhuta = new mahabhuta.MahafuncArray(pluginName, {});

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
                let amazonCode = metadata.config.plugin(pluginName)
                        .amazonCodeForCountry(metadata.config, amazonSite.country);
                // console.log(`${urlP.hostname} is ${amazonSite.domain}? ${amazonSite.domain.test(urlP.hostname)} amazonCode ${amazonCode}`);
                if (domainMatch(amazonSite.domain, href) /* amazonSite.domain.test(urlP.hostname) */ && amazonCode) {
                    akasha.linkRelSetAttr($link, 'nofollow', true);
                    $link.attr('href', setAmazonAffiliateTag(href, amazonCode));
                    // console.log(`set href ${$link.attr('href')} rel ${$link.attr('rel')}`);
                }
            });

            if (metadata.config.plugin(pluginName).doNoSkimlinksForDomain(metadata.config, urlP.hostname)) {
                akasha.linkRelSetAttr($link, 'noskim', true);
            }
            if (metadata.config.plugin(pluginName).doNoViglinksForDomain(metadata.config, urlP.hostname)) {
                akasha.linkRelSetAttr($link, 'norewrite', true);
            }
        }

        return Promise.resolve("");
    }
}
module.exports.mahabhuta.addMahafunc(new AffiliateLinkMunger());

class AffiliateProductContent extends mahabhuta.CustomElement {
    get elementName() { return "affiliate-product"; }
    async process($element, metadata, dirty) {
        const template = $element.attr('template') 
                ? $element.attr('template')
                : "affiliate-product.html.ejs";
        const productid = $element.attr('productid');
        const href = $element.attr('href');
        const data = await getProductData(metadata, href, productid);
        if (!data) {
            throw new Error(`affiliate-product: No data found for ${productid} in ${metadata.document.path}`);
        }
        data.partialBody = $element.html();
        // dirty();
        return akasha.partial(metadata.config, template, data);
    }
}
module.exports.mahabhuta.addMahafunc(new AffiliateProductContent());

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
        data.products = await getProductList(metadata, href, productids);
        if (!data.products || data.products.length <= 0) {
            throw new Error(`affiliate-product-accordion: No data found for ${util.inspect(productids)} in ${metadata.document.path}`);
        }
        data.products[0].isactive = "show active";
        // console.log(`affiliate-product-accordion ${id} ${util.inspect(data)}`);
        dirty();
        return akasha.partial(metadata.config, template, data);
    }
}
module.exports.mahabhuta.addMahafunc(new AffiliateProductAccordionContent());

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
        data.products = await getProductList(metadata, href, productids);
        if (!data.products || data.products.length <= 0) {
            throw new Error(`affiliate-product-table: No data found for ${util.inspect(productids)} in ${metadata.document.path}`);
        }
        data.products[0].isactive = "show active";
        // console.log(`affiliate-product-table ${id} ${util.inspect(data)}`);
        // dirty();
        return akasha.partial(metadata.config, template, data);
    }
}
module.exports.mahabhuta.addMahafunc(new AffiliateProductTableContent());

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

        const data = await getProductData(metadata, href, productid);
        if (!data) {
            throw new Error(`affiliate-product: No product data found for ${productid} in ${metadata.document.path}`);
        }
        var productHref = href;
        if (data.anchorName) productHref += '#' + data.anchorName;
        const productdescription = data.productdescription;

        if (type === "card") {
            dirty();
            return akasha.partial(metadata.config, template, {
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
module.exports.mahabhuta.addMahafunc(new AffiliateProductLink());

class AmazonBuyButtonElement extends mahabhuta.CustomElement {
    get elementName() { throw new Error("Use a subclass"); }
    process($element, metadata, dirty) {

        const asin     = $element.attr('asin');
        const display  = $element.attr('display');
        const affcode  = $element.attr('affcode')
                ? $element.attr('affcode')
                : metadata.config.pluginData(pluginName).amazonAffiliateCode[this.countryCode];
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
            return akasha.partial(metadata.config, template, {
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
module.exports.mahabhuta.addMahafunc(new AmazonCABuyButtonElement());

// TBD: amazon-cn-buy

class AmazonJPBuyButtonElement extends AmazonBuyButtonElement {
    get elementName() { return "amazon-co-jp-buy"; }
    get defaultTemplate() { return "amazon-co-jp-buy.html.ejs"; }
    get countryCode() { return "co-jp"; }
}
module.exports.mahabhuta.addMahafunc(new AmazonJPBuyButtonElement());

class AmazonUKBuyButtonElement extends AmazonBuyButtonElement {
    get elementName() { return "amazon-co-uk-buy"; }
    get defaultTemplate() { return "amazon-co-uk-buy.html.ejs"; }
    get countryCode() { return "co-uk"; }
}
module.exports.mahabhuta.addMahafunc(new AmazonUKBuyButtonElement());

class AmazonUSABuyButtonElement extends AmazonBuyButtonElement {
    get elementName() { return "amazon-com-buy"; }
    get defaultTemplate() { return "amazon-com-buy.html.ejs"; }
    get countryCode() { return "com"; }
}
module.exports.mahabhuta.addMahafunc(new AmazonUSABuyButtonElement());

class AmazonDEBuyButtonElement extends AmazonBuyButtonElement {
    get elementName() { return "amazon-de-buy"; }
    get defaultTemplate() { return "amazon-de-buy.html.ejs"; }
    get countryCode() { return "de"; }
}
module.exports.mahabhuta.addMahafunc(new AmazonDEBuyButtonElement());

class AmazonESBuyButtonElement extends AmazonBuyButtonElement {
    get elementName() { return "amazon-es-buy"; }
    get defaultTemplate() { return "amazon-es-buy.html.ejs"; }
    get countryCode() { return "es"; }
}
module.exports.mahabhuta.addMahafunc(new AmazonESBuyButtonElement());

class AmazonFRBuyButtonElement extends AmazonBuyButtonElement {
    get elementName() { return "amazon-fr-buy"; }
    get defaultTemplate() { return "amazon-fr-buy.html.ejs"; }
    get countryCode() { return "fr"; }
}
module.exports.mahabhuta.addMahafunc(new AmazonFRBuyButtonElement());

// TBD amazon-in-buy

class AmazonITBuyButtonElement extends AmazonBuyButtonElement {
    get elementName() { return "amazon-it-buy"; }
    get defaultTemplate() { return "amazon-it-buy.html.ejs"; }
    get countryCode() { return "it"; }
}
module.exports.mahabhuta.addMahafunc(new AmazonITBuyButtonElement());

// TBD: amazon-mx-buy
