'use strict'

const createBrowserless = require('browserless')

const test = require('ava')

const browserless = () => {
  const browserlessFactory = createBrowserless()
  const browserlessPromise = browserlessFactory.createContext()
  return browserlessPromise.then(browserContext => {
    browserContext.close = browserlessFactory.close
    return browserContext
  })
}

test.after(async () => {
  const browser = await browserless()
  browser.close()
})

const pretty = require('../src/pretty')

test('application/json', async t => {
  const browser = await browserless()
  const page = await browser.page()

  const payload = {
    version: 2,
    status: 'success',
    data: {
      emoji: '<required> an URL for getting content.',
      vendor: "[optional] The vendor look and feel to be applied ('apple' by default)."
    },
    example: 'https://emojipedia-api.vercel.app?emoji=💩&vendor=skype',
    message: 'Welcome to Emojipedia unofficial API.',
    author: 'https://twitter.com/Kikobeats'
  }

  const response = {
    json: () => payload,
    headers: () => ({ 'content-type': 'application/json; charset=utf-8' })
  }

  const opts = {
    codeScheme: 'ghcolors',
    styles: [
      '#screenshot code.language-js{font-family:"Roboto Mono"}',
      '#screenshot .token{color:#f81ce5}'
    ]
  }
  await pretty(page, response, opts)
  const html = await page.content()

  t.snapshot(html)
})

test('text/plain', async t => {
  const browser = await browserless()
  const page = await browser.page()
  const payload = 'Open the network tab in devtools to see the response headers'

  const response = {
    text: () => payload,
    headers: () => ({ 'content-type': 'text/plain; charset=UTF-8' })
  }

  const opts = {
    codeScheme: 'ghcolors',
    styles: ['#screenshot code.language-text{font-family:"Roboto Mono";color:#f81ce5}']
  }
  await pretty(page, response, opts)
  const html = await page.content()

  t.snapshot(html)
})

test('text/html', async t => {
  const browser = await browserless()
  const page = await browser.page()
  const payload = 'Open the network tab in devtools to see the response headers'

  const response = {
    text: () => payload,
    headers: () => ({ 'content-type': 'text/plain; charset=UTF-8' })
  }

  const opts = {
    codeScheme: 'ghcolors',
    styles: ['#screenshot code.language-text{font-family:"Roboto Mono";color:#f81ce5}']
  }
  await pretty(page, response, opts)
  const html = await page.content()

  t.snapshot(html)
})
