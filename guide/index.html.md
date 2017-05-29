---
layout: plugin-documentation.html.ejs
title: AskashaCMS Affiliate-Link generator documentation
---

Affiliate Marketing is a common way to monetize a website.  The concept is simple, you make a specially constructed link to a product on a merchants website, and if a visitor clicks through that link then buys the product you get a commission.  It's possible to have a product catalog of items you recommend to your readers, without having to stock a warehouse, handle order fulfillment, and all the other details involved with selling stuff.

The `akashacms-affiliates` plugin simplifies the task of maintaining a list of products where you have affiliate links.

# Installation

With an AkashaCMS website setup, add the following to `package.json`

```
  "dependencies": {
    ...
    "akashacms-affiliates": "akashacms/akashacms-affiliates"
    ...
  }
```

I haven't decided to publish this plugin to `npm` yet.  Instead, at the moment, one should access it as shown here from the Github repository.

Once added to `package.json` run: `npm install`

# Configuration

In `config.js` for the website:

```
config.use(require('akashacms-affiliates'));

config.plugin("akashacms-affiliates")
    .amazonAffiliateCode(config, 'com', 'YOUR AMAZON AFFILIATE CODE')
    .loadAffiliateProducts(config, 'affiliate-products.yml');
```

The first line of course loads the plugin code.  Then, you configure the plugin by calling the methods.

With `amazonAffiliateCode` you declare your Amazon affiliate code for the given country code.  The country codes supported are as so:

* `com` USA
* `ca` Canada
* `co-jp` Japan
* `co-uk` United Kingdom
* `de` Germany
* `es` Spain
* `fr` France
* `it` Italy

The country code is used in several ways.  Amazon gives you a different affiliate ID for each country in which you form an affiliate relationship.  It's necessary for the plugin to know which affiliate ID to use depending on the country code of the product.

With `loadAffiliateProducts` you load product data from a YAML file.  The file is described below.

# Custom elements

## Render full information about an affiliate product

With `<affiliate-product>` you can easily show the information block about an affiliate product.  The simplest use is this:

```
<affiliate-product productid="B003D6F5HQ"/>
```

The `productid` parameter references the `productid` of an affiliate product.  The data is rendered through a template, and the default partial template is `affiliate-product.html.ejs`.  If you wish to use a different partial template, specify that with the `template` attribute.

## Linking to an affiliate product from elsewhere on the site

Sometimes you want to have a link from several places to a specific page holding the full affiliate product description.  For example you might have one or more "catalog" pages listing items of a given type.  Then elsewhere on the site, you might want to link to a specific item on one of these catalog pages.

```
<affiliate-product-link productid="0914955748" type="card">
```

This references an affiliate product using the same `productid` attribute.  The `type` attribute specifies whether to show an information card (the thumbnail and link), using the `card` value, or just a link, using the `link` value.

For the `card` link, there is a default partial template named `affiliate-product-link-card.html.ejs`.  You can specify a different partial template with the `template` attribute.

To support this feature, the affiliate product must have an `href` attribute.  That attribute contains the `href` of the page that is to be linked to.

## Amazon "buy" buttons

It's possible to put a "buy" button that automatically adds the product to the users Amazon shopping cart.  There are some benefits to doing this.

There are several custom elements corresponding to the country codes.

* `amazon-ca-buy` Canada
* `amazon-co-jp-buy` Japan
* `amazon-co-uk-buy` United Kingdom
* `amazon-com-buy` USA
* `amazon-de-buy` Germany
* `amazon-es-buy` Spain
* `amazon-fr-buy` France
* `amazon-it-buy` Italy

The `asin` attribute specifies the Amazon product ID.  The `affcode` attribute lets you override the affiliate ID you might have registered for the country code using the `amazonAffiliateCode` method.  The `template` attribute overrides the default partial template.

The default templates are of course as so:

* `amazon-ca-buy.html.ejs` Canada
* `amazon-co-jp-buy.html.ejs` Japan
* `amazon-co-uk-buy.html.ejs` United Kingdom
* `amazon-com-buy.html.ejs` USA
* `amazon-de-buy.html.ejs` Germany
* `amazon-es-buy.html.ejs` Spain
* `amazon-fr-buy.html.ejs` France
* `amazon-it-buy.html.ejs` Italy

# Affiliate product YAML file

The function `config.plugin("akashacms-affiliates").affiliateProduct(config, productid, data)` will load a single product into the list of affiliate products.  As a convenience you can create a YAML file containing a whole list of affiliate products.  That file is loaded using the `loadAffiliateProducts(config, 'affiliate-products.yml')` as we said earlier.

When loaded, a top level attribute `products` is looked for.  That attribute is interpreted as an array, each element of the array is added using the `affiliateProduct` method.

This object contains several fields describing attributes of the affiliate product.  

The `productid` mentioned earlier is held in the `code` attribute of the object.

The `anchorName` and `href` attributes are used by the `affiliate-product-link` element mentioned earlier.

The `productname` attribute is, as implied, the name of the product.  The `productbuyurl` attribute is the primary link to use through which the visitor should buy the product.  The `productimgurl` attribute is the image to show the visitor.  The `productrel` attribute contains the `rel=` string to use in links to the product.  It is common to use `rel="nofollow"` since the search engines have started to be strict about whether links with commercial gain should grant page ranking.

The `productdescription` is your description of the product.  This can be a simple string, or it can be a long text field if you use YAML notation as so:

```
    productdescription: |
        <p>This is a paragraph of text</p>

        <p>This is another paragraph of text</p>

        <p>This is yet another paragraph of text</p>
```

If you want Amazon "Buy" buttons, the `productamzn` attribute lists the country code and ASIN to use.  It is interpreted as an array, so that you can have multiple buttons.

A full example is :-

```
    - code: "0914955756"
      anchorName: "HayashiReikiManual"
      href: "/catalog/reiki-books.html"
      productname: "The Hayashi Reiki Manual: Traditional Japanese Healing Techniques from the Founder of the Western Reiki System"
      productbuyurl: "https://www.amazon.com/gp/product/0914955756/ref=as_li_ss_tl?ie=UTF8&linkCode=ll1&tag=thereikipage&linkId=d768039933d1748bcfd8451451c4fd75"
      productimgurl: "https://images-na.ssl-images-amazon.com/images/I/517RlA0bwfL.jpg"
      productrel: "nofollow noskim"
      productdescription: |
          <p>In this book Frank Arjava Petter turns to Dr. Hayashi's method for teaching Reiki.  It not only contains Dr. Hayashi's story, but an English translation of Hayashi's Ryoho Shishin.  Co-written by Frank Arjava Petter and Tadao Yamaguchi, it contains historical information of Hayashi and other teachers in his lineage.  Yamaguchi-san's family has practiced Reiki in Japan since learning it from Hayashi-san.</p>

          <p>Original documents are included written by Hayashi, and it contains a complete translation of his manual.</p>
      productamzn:
        - asin: "0914955756"
          countryCode: com
```

It is important to put quotes around the `code` and `asin` attributes.  Valid Amazon ASIN's includes numerical strings that can look like an octal number.  If a particular ASIN starts with `0` and then contains digits between `0` and `7` then the YAML parser will interpret that product ID as an octal number, leading you to scratching your head and muttering about what the ____ is going on.  It's simple to just put quotes around those attributes so that YAML doesn't help you by interpreting a product ID as an octal number.
