const express = require('express');
const cors = require('cors');
const fs = require('fs');
const axios = require('axios');
const app = express();
const port = 3300;

app.use(cors());
app.use(express.json());

const cache = {};
const cacheDuration = 7 * 24 * 60 * 60 * 1000; // 7 days
const reserveLimit = 12000;

function fetchJSON(url) {
  const currentTime = new Date().getTime();
  if (cache[url] && (currentTime - cache[url].timestamp < cacheDuration)) {
    return Promise.resolve(new Set(cache[url].data));
  } else {
    return axios.get(url)
      .then(response => {
        const dataSet = new Set(response.data.map(addr => addr.toLowerCase()));
        cache[url] = {
          data: dataSet,
          timestamp: currentTime
        };
        return dataSet;
      })
      .catch(error => {
        console.error(`Failed to fetch data from ${url}: ${error}`);
        return new Set();
      });
  }
}

async function getAddressCategory(address) {
  const partnersUrl = 'https://api.npoint.io/1b73518ed7c18a19be3e';
  const earlyAdoptersUrl = 'https://api.npoint.io/38e4c7dfd7af5f838170';

  try {
    const [partnersAddresses, earlyAdoptersAddresses] = await Promise.all([
      fetchJSON(partnersUrl),
      fetchJSON(earlyAdoptersUrl)
    ]);
    const isEligiblePartner = partnersAddresses.has(address);
    const isEligibleEarlyAdopter = earlyAdoptersAddresses.has(address);
    
    if(isEligiblePartner) return "partner";
    if(isEligibleEarlyAdopter) return "early";
    return null;
  } catch (error) {
    return null;
  }
}

const reservedSpotFile = 'reserved-spots.json';

// Initialize the addresses file if it does not exist
if (!fs.existsSync(reservedSpotFile)) {
  fs.writeFileSync(reservedSpotFile, JSON.stringify([]));
}

app.get('/verify/:address', async (req, res) => {
  const address = req.params.address.toLowerCase();
  const category = await getAddressCategory(address);
  
  if(category === "partner") {
    res.json({ category: "Alpha Partner", amount: 10000 });
  } else if (category === "early") {
    res.json({ category: "Early Adopter", amount: 10000 });
  } else {
    res.json(null);
  }
});

app.get('/reserve/all', (req, res) => {
  const reservedAddresses = JSON.parse(fs.readFileSync(reservedSpotFile, 'utf8'));
  res.json(reservedAddresses);
});

app.get('/reserve/:address', (req, res) => {
  const address = req.params.address.toLowerCase();
  const addresses = new Set(JSON.parse(fs.readFileSync(reservedSpotFile, 'utf8')));
  const isEligible = addresses.has(address);
  if (isEligible) {
    res.json({ amount: 10000, rate: (addresses.size / reserveLimit) * 100 });
  } else {
    res.json({ amount: 0, rate: (addresses.size / reserveLimit) * 100 });
  }
});

app.post('/reserve', async (req, res) => {
  const address = req.body.address.toLowerCase();
  let addresses = new Set(JSON.parse(fs.readFileSync(reservedSpotFile, 'utf8')));

  if (addresses.size >= reserveLimit) {
    res.json({ added: false, message: "Reservation limit reached" });
    return;
  }

  const category = await getAddressCategory(address);
  
  if(category) {
    if (!addresses.has(address)) {
      addresses.add(address);
      fs.writeFileSync(reservedSpotFile, JSON.stringify([...addresses], null, 2)); // Save with formatting
    }

    res.json({ added: true });
  } else {
    res.json({ added: false });
  }
});

app.get('/', (req, res) => {
  res.send('Hello there!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});