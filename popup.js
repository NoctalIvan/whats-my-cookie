// last cookies retrieved from the active tab
let cookieCache = null

// gets the current (base) url
const getUrl = async () => {
  const url = await new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0].url)
    })
  })

  return url
}

// recovers cookies for the current active tab
const getCookies = async (url) => {
  const cookies = await new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.cookies.getAll({ url: tabs[0].url }, (cookies) => {
        resolve(cookies)
      })
    })
  })

  const enrichedCookies = cookies.map((cookie) => {
    const dbHit = cookieDb.find((dbCookie) =>
      (dbCookie['Wildcard match'] === 0 && dbCookie['Cookie / Data Key name'] === cookie.name) ||
      (dbCookie['Wildcard match'] === 1 && cookie.name.includes(dbCookie['Cookie / Data Key name']))
    )

    if (dbHit) {
      return {
        name: cookie.name,
        type: dbHit.Category,
        typeExplanation: cookieTypes[dbHit.Category],
        description: dbHit.Description,
        dataController: dbHit['Data Controller'],
        gdpr: dbHit['User Privacy & GDPR Rights Portals'],
        retention: dbHit['Retention period'],
        }
      }

    return {
      name: cookie.name,
      type: 'Unknown',
      typeExplanation: cookieTypes['Unknown'],
      description: 'No information available.',
      dataController: '--',
    }
  })

  return enrichedCookies
}

// renders the table of cookies in popup.html
const renderCookieTable = ({ cookies, url }) => {
  const cnt = document.getElementById('cookie-table-cnt')

  if (cookies.length === 0) {
    const cleanUrl = url.replace(/https?:\/\//, '').replace(/\/$/, '')
    cnt.innerHTML = `<p class="no-cookies">The website <strong class="text-gradient">${cleanUrl}</strong> does not use any cookies</p>`
    return
  }

  cnt.innerHTML = `<table class="cookie-table"><thead>
    <tr>
      <th class="col-name">Name</th>
      <th class="col-category">Category</th>
      <th class="col-controller">Data Controller</th>
    </tr>
  </thead><tbody>${cookies.map((cookie, index) =>
    `<tr cookie-index="${index}">
      <td class="col col-name">${cookie.name}</td>
      <td class="col col-category">${cookie.type}</td>
      <td class="col col-controller">${cookie.dataController}</td>
    </tr>`
  ).join('')}</tbody></table>`

  // inject event listeners
  const rows = cnt.querySelectorAll('tr')
  rows.forEach((row) => {
    row.addEventListener('click', onSelectCookie)
  })
}

// actions
const onSelectCookie = (evt) => {
  const cookieIndex = evt.target.parentElement.getAttribute('cookie-index')
  const cookie = cookieCache[+cookieIndex]

  const cnt = document.getElementById('cookie-details-cnt')
  const cookieDetails = cnt.querySelector('.cookie-details')
  cookieDetails.innerHTML = `
    <h3 class="text-gradient">${cookie.name}</h3>
      <div id="close-btn">X</div>

      <div class="title text-gradient">Category</div>
      <div class="data">
        <strong>${cookie.type}</strong> - ${cookie.typeExplanation}
      </div>
      ${cookie.type === 'Unknown' ? '' : `
        <div class="title text-gradient">Description</div>
        <div class="data">${cookie.description}</div>

        <div class="title text-gradient">Data Controller</div>
        <div class="data">
          ${cookie.dataController}
          -
          <a href="${cookie.gdpr}" target="_blank">See their data policy</a>
        </div>

        <div class="title text-gradient">Retention Period</div>
        <div class="data">${cookie.retention}</div>
      `}
    </div>
  </div>`
  
  cnt.classList.add('visible')

  const closeBtn = cnt.querySelector('#close-btn')
  closeBtn.addEventListener('click', () => {
    cnt.classList.remove('visible')
  })

  const overlay = cnt.querySelector('.overlay')
  overlay.addEventListener('click', () => {
    cnt.classList.remove('visible')
  })
}

// main function
const main = async () => {
  const url = await getUrl()
  const cookies = await getCookies(url)
  cookieCache = cookies
  renderCookieTable({ cookies, url })
}

main()