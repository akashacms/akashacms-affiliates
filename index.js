/**
 *
 * Copyright 2017 David Herron
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
const mahabhuta = require('mahabhuta');
const yaml = require('js-yaml');


const log   = require('debug')('akasha:affiliates-plugin');
const error = require('debug')('akasha:error-affiliates-plugin');

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

    loadAffiliateProducts(config, yamlFile) {
        var doc = yaml.safeLoad(fs.readFileSync(yamlFile, 'utf8'));
        for (var product of doc.products) {
            this.affiliateProduct(config, product.code, product);
        }
        return this;
    }


};

module.exports.mahabhuta = new mahabhuta.MahafuncArray(pluginName, {});

class AffiliateProductContent extends mahabhuta.CustomElement {
    get elementName() { return "affiliate-product"; }
    process($element, metadata, dirty) {
        dirty();
        var template = $element.attr('template');
        if (!template) template = "affiliate-product.html.ejs";

        var productid = $element.attr('productid');
        if (! productid in metadata.config.pluginData(pluginName).products) {
            throw new Error(`Unknown affiliate product ${productid}`);
        }
        var data = metadata.config.pluginData(pluginName).products[productid];
        if (!data) {
            throw new Error(`affiliate-product: No data found for ${productid} in ${metadata.document.path}`);
        }
        var body = $element.html();
        data.partialBody = body;
        return akasha.partial(metadata.config, template, data);
    }
}
module.exports.mahabhuta.addMahafunc(new AffiliateProductContent());

class AffiliateProductLink extends mahabhuta.CustomElement {
    get elementName() { return "affiliate-product-link"; }
    process($element, metadata, dirty) {
        dirty();
        var productid = $element.attr('productid');
        var type = $element.attr('type');
        var width = $element.attr('width');
        var template = $element.attr('template');

        if (!productid)
            return next(new Error(`affiliate-product-link: no productid= provided in ${metadata.document.path}`));
        if (!type) type = "card";

        var data = metadata.config.pluginData(pluginName).products[productid];
        if (!data) {
            throw new Error(`affiliate-product: No data found for ${productid} in ${metadata.document.path}`);
        }
        var href = data.href;
        if (data.anchorName) href += '#' + data.anchorName;

        if (type === "card") {
            if (!template) template = "affiliate-product-link-card.html.ejs";
            return akasha.partial(metadata.config, template, {
                productid: productid, href: href,
                title: data.productname, thumburl: data.productimgurl,
                content: $element.contents(),
                width: width ? width : "200px"
            });
        } else if (type === "link") {
            return Promise.resolve(`<a href='${href}'>${data.productname}</a>`);
            next();
        }
    }
}
module.exports.mahabhuta.addMahafunc(new AffiliateProductLink());

class AmazonBuyButtonElement extends mahabhuta.CustomElement {
    get elementName() { throw new Error("Use a subclass"); }
    process($element, metadata, dirty) {

        var asin     = $element.attr('asin');
        var display  = $element.attr('display');
        var affcode  = $element.attr('affcode');
        var target   = $element.attr('target');
        var template = $element.attr('template');
        if (!affcode) affcode = metadata.config.pluginData(pluginName).amazonAffiliateCode[this.countryCode];
        if (!target) target = "_blank";
        if (!template) template = this.defaultTemplate;

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
