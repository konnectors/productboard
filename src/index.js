process.env.SENTRY_DSN =
  process.env.SENTRY_DSN ||
  'https://92eb3c5e4fd847018d39d78d760c229f:f4819b906d66453d97f00254400fa621@sentry.cozycloud.cc/78'

const { BaseKonnector, saveBills, log } = require('cozy-konnector-libs')
const cheerio = require('cheerio')
const moment = require('moment')
const request = require('request-promise').defaults({ jar: true })

module.exports = new BaseKonnector(start)

async function start(fields) {
  log('info', 'Authenticating ...')
  const documents = await authenticate(fields.login, fields.password)
  log('info', 'Saving data to Cozy')
  await saveBills(documents, fields.folderPath, {
    identifiers: ['productboard']
  })
}

function authenticate(username, password) {
  return request('https://cozycloud.productboard.com/')
    .then(body => {
      const $ = cheerio.load(body)
      return request({
        uri: 'https://cozycloud.productboard.com/users/sign_in',
        method: 'POST',
        formData: {
          'user[email]': username,
          'user[password]': password,
          'user[remember_me]': 'false'
        },
        followAllRedirects: true, // /!\
        headers: {
          'X-CSRF-Token': $('[name="csrf-token"]').attr('content')
        }
      })
    })
    .then(() => {
      const options = {
        uri: 'https://cozycloud.productboard.com/api/all.json',
        json: true
      }
      return request(options)
    })
    .then(body => {
      return body.subscription_invoices.map(invoice => {
        const dateObj = moment(invoice.created_at)
        const refund = invoice.total < 0
        return {
          amount: Math.abs(invoice.total),
          isRefund: refund,
          date: dateObj.toDate(),
          currency: '€',
          vendor: 'ProductBoard',
          fileurl: invoice.invoice_url,
          filename: `${dateObj.format('YYYY-MM-DD')}_${invoice.total}€_${
            invoice.id
          }.pdf`
        }
      })
    })
}
