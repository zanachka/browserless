'use strict'

const extractDomain = require('extract-domain')
const requireOneOf = require('require-one-of')
const debug = require('debug')('browserless')
const pTimeout = require('p-timeout')

const { getDevice } = require('./devices')
const isTracker = require('./is-tracker')

const WAIT_UNTIL = ['networkidle0']

const EVALUATE_TEXT = page => page.evaluate(() => document.body.innerText)

const EVALUATE_HTML = page => page.content()

const isExternalUrl = (domainOne, domainTwo) => domainOne !== domainTwo

const isEmpty = val => val == null || !(Object.keys(val) || val).length

module.exports = ({
  puppeteer = requireOneOf(['puppeteer', 'puppeteer-core', 'puppeteer-firefox']),
  incognito = false,
  timeout = 30000,
  ...launchOpts
} = {}) => {
  let browser = puppeteer.launch({
    ignoreHTTPSErrors: true,
    args: [
      '--disable-notifications',
      '--disable-offer-store-unmasked-wallet-cards',
      '--disable-offer-upload-credit-cards',
      '--disable-setuid-sandbox',
      '--enable-async-dns',
      '--enable-simple-cache-backend',
      '--enable-tcp-fast-open',
      '--media-cache-size=33554432',
      '--no-default-browser-check',
      '--no-pings',
      '--no-sandbox',
      '--no-zygote',
      '--prerender-from-omnibox=disabled'
    ],
    ...launchOpts
  })

  const newPage = () =>
    Promise.resolve(browser).then(async browser => {
      const context = incognito ? await browser.createIncognitoBrowserContext() : browser
      const page = await context.newPage()
      page.setDefaultNavigationTimeout(timeout)
      return page
    })

  const wrapError = fn => async (...args) => {
    const page = await newPage()
    let error
    let res

    try {
      res = await pTimeout(fn(page)(...args), timeout)
    } catch (err) {
      error = err
    }

    await page.close()
    if (error) throw error
    return res
  }

  const goto = async (
    page,
    {
      url,
      device,
      abortTrackers,
      abortTypes = [],
      waitFor = 0,
      waitUntil = WAIT_UNTIL,
      userAgent: fallbackUserAgent,
      viewport: fallbackViewport,
      ...args
    }
  ) => {
    await page.setRequestInterception(true)
    let reqCount = { abort: 0, continue: 0 }

    page.on('request', req => {
      const resourceUrl = req.url()

      const resourceType = req.resourceType()

      if (abortTypes.includes(resourceType)) {
        debug(`abort:${resourceType}:${++reqCount.abort}`, resourceUrl)
        return req.abort()
      }

      const urlDomain = extractDomain(url)
      const resourceDomain = extractDomain(resourceUrl)
      const isExternal = isExternalUrl(urlDomain, resourceDomain)

      if (abortTrackers && isExternal && isTracker(resourceDomain)) {
        debug(`abort:tracker:${++reqCount.abort}`, resourceUrl)
        return req.abort()
      }
      debug(`continue:${resourceType}:${++reqCount.continue}`, resourceUrl)
      return req.continue()
    })

    const { userAgent: deviceUserAgent, viewport: deviceViewport } = getDevice(device) || {}

    const userAgent = deviceUserAgent || fallbackUserAgent
    if (userAgent) await page.setUserAgent(userAgent)
    const viewport = { ...deviceViewport, ...fallbackViewport }
    if (!isEmpty(viewport)) await page.setViewport(viewport)
    const response = await page.goto(url, { waitUntil, ...args })
    if (waitFor) await page.waitFor(waitFor)
    debug(reqCount)
    return response
  }

  const evaluate = fn =>
    wrapError(page => async (url, opts = {}) => {
      const {
        abortTrackers = true,
        abortTypes = ['image', 'imageset', 'media', 'stylesheet', 'font', 'object', 'sub_frame'],
        ...args
      } = opts

      const response = await goto(page, {
        url,
        abortTrackers,
        abortTypes,
        ...args
      })

      return fn(page, response)
    })

  const screenshot = wrapError(page => async (url, opts = {}) => {
    const { device = 'macbook pro 13', tmpOpts, type = 'png', viewport, ...args } = opts

    await goto(page, { url, device, ...args })
    return page.screenshot({ type, ...args })
  })

  const pdf = wrapError(page => async (url, opts = {}) => {
    const {
      format = 'A4',
      margin = {
        top: '0.25cm',
        right: '0.25cm',
        bottom: '0.25cm',
        left: '0.25cm'
      },
      media = 'screen',
      printBackground = true,
      scale = 0.65,
      tmpOpts,
      viewport,
      ...args
    } = opts

    await page.emulateMedia(media)
    await goto(page, { url, ...args })
    return page.pdf({
      margin,
      format,
      printBackground,
      scale,
      ...args
    })
  })

  return {
    browser,
    html: evaluate(EVALUATE_HTML),
    text: evaluate(EVALUATE_TEXT),
    evaluate,
    pdf,
    screenshot,
    page: newPage,
    goto
  }
}

module.exports.devices = require('./devices')