const { readFileSync, writeFileSync } = require('fs')
const { JSDOM } = require('jsdom')

function extractTravelsData(filePath) {
  const fileContent = readFileSync(filePath)
    .toString()
    .replace(/\\r\\n/g, '').replace(/\\/g, '')
  const dom = new JSDOM(fileContent)
  const { window: { document } } = dom

  return document
}

function parseDocument(document) {
  const pnrInfoDocuments = getElementsByClass(document, 'pnr-info')
                          .map(e => e.textContent.trim())
  
  const price = getElementsByClass(document, 'very-important')
                  .map(e => parseFloat(e.textContent
                            .match(/(\d)*,(\d)*/)[0]
                            .replace(',', '.'))
                  )[0]
  const productDates = getElementsByClass(document, 'pnr-summary')
                      .map(e => e.textContent.match(/(\d{2}\/){2}\d{4}/g))
                      .reduce((a, b) => [...a, ...b])
  const passengers = getElementsByClass(document, 'passengers')
                    .map(e => getElementsByClass(e, 'typology').map(e => e.textContent.trim()))
  const productDetails = getElementsByClass(document, 'product-details')
  
  const roundTrips = getRoundTrips(productDetails, productDates, passengers)
  const prices = getPrices(document)

  const result = {
    'status': 'ok',
    'result': {
      'trips': [
        {
          'code': pnrInfoDocuments[pnrInfoDocuments.length - 2],
          'name': pnrInfoDocuments[pnrInfoDocuments.length - 1],
          'details': {
            price,
            roundTrips
          }
        }
      ],
      'customs': {
        prices
      }
    }
  }

  return result
}

function getElementsByClass(document, className) {
  return Object.values(document.getElementsByClassName(className))
}

function getElementsByTagName(document, tagName) {
  return Object.values(document.getElementsByTagName(tagName))
}

function getRoundTrips(productDetails, productDates, passengers) {
  return productDetails.map((e, i) => {
    const dateSplit = productDates[i].split('/')
    return {
      'type': getElementsByClass(e, 'travel-way').map(e => e.textContent)[0].trim(),
      'date': new Date(dateSplit[2], dateSplit[1] - 1, dateSplit[0]),
      'trains': [
        {
          'departureTime': getElementsByClass(e, 'origin-destination-hour').map(e => e.textContent)[0].trim().replace('h', ':'),
          'departureStation': getElementsByClass(e, 'origin-destination-station').map(e => e.textContent)[0].trim(),
          'arrivalTime': getElementsByClass(e, 'origin-destination-hour segment-arrival').map(e => e.textContent)[0].trim().replace('h', ':'),
          'arrivalStation': getElementsByClass(e, 'origin-destination-station segment-arrival').map(e => e.textContent)[0].trim(),
          'type':  getElementsByClass(e, 'segment').map(e => e.textContent)[0].trim(),
          'number': getElementsByClass(e, 'segment').map(e => e.textContent)[1].trim(),
          'passengers': passengers[i].map(e => {
            return {
              'type': 'échangeable',
              'age': e.match(/\(.*\)/)[0]
            }
          })
        }
      ] 
    }
  })
}

function getPrices(document) {
  return getElementsByClass(document, 'product-header')
                  .map(e => {
                    const contentHeader = getElementsByTagName(e, 'td').map(e => e.textContent.trim())
                    return {
                      'value': parseFloat(contentHeader[contentHeader.length - 1]
                                          .match(/(\d)*,(\d)*/)[0]
                                          .replace(',', '.'))
                    }
                  })
}

try {
  const args = process.argv.slice(2)

  if (args.length <= 1) {
    throw new Error('Missing Arguments : parser.js <input> <output>')
  }

  const document = extractTravelsData(args[0])
  const json = parseDocument(document)
  writeFileSync(args[1], JSON.stringify(json, null, 2))

  console.log(`Done: check file : ${args[1]}`)
} catch(e) {
  console.log({
    'status': 'ko',
    'result': e.message
  })
}
