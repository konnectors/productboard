const { BaseKonnector, saveBills, log } = require('cozy-konnector-libs')
const cheerio = require('cheerio')
const request = require('request-promise').defaults({ jar: true })

module.exports = new BaseKonnector(start)

async function start(fields) {
  log('info', 'Authenticating ...')
  const documents = await authenticate(fields.login, fields.password)
  log('info', 'Saving data to Cozy')
  await saveBills(documents, fields.folderPath, {})
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
      return body.subscription_invoices.map(invoice => ({
        amount: invoice.total,
        date: invoice.created_at,
        currency: '€',
        vendor: 'ProductBoard',
        fileurl: invoice.invoice_url
      }))
    })
}
