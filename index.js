// This scrape a webpage for data on a fish tanks elements and save the data as a csv

// import the required modules
const fs = require("fs"); // to save the csv
const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout
}); // get some user input for the username/email and password

const puppeteer = require("puppeteer");
const Papa = require("papaparse");

// get the users email via cli
async function askQuestion(question) {
    return new Promise((resolve, reject) => {
        try {
            readline.question(question, resolve)
        } catch (err) {
            reject(err);
        }
    })
}

async function wait(ms) {
    return new Promise((res) => {
        setTimeout(res, ms);
    });
}

(async () => {
    try {


        // First get an credentials need to Log in
        let usersEmailAddress = await askQuestion("Enter Email Address: ");
        let usersPassword = await askQuestion("Enter Password: ");

        console.log(usersEmailAddress, usersPassword);

        // Initialise the browser and goto the web page
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto("https://www.reef-zlements.com/my-account/");
        console.log("First page loaded");
        console.log("Logging into the site");
        // log into the site
        await page.waitForSelector("input[name=username]");
        await page.type("input[name=username]", usersEmailAddress);

        await page.waitForSelector("input[name=username]");
        await page.type("input[name=password]", usersPassword);

        await page.$eval("button[type=submit]", el => el.click());

        // wait for login to finish then navigate to the record list
        await page.waitForSelector(".woocommerce-MyAccount-navigation-link--test-record > a");
        console.log("Log in success");
        await page.click(".woocommerce-MyAccount-navigation-link--test-record > a");
   
        // wait for the
        await page.waitForSelector("table[data-sort-table=no]");
        console.log("Finding reports");
        let reports = await page.evaluate(() => {
            const rowNodeList = document.querySelectorAll("table[data-sort-table=no] tr");
            const rowArray = Array.from(rowNodeList);
            return rowArray.map(tr => {
                const dataNodeList = tr.querySelectorAll('td');
                const dataArray = Array.from(dataNodeList);
                const [num, id, tank, vol, date] = dataArray.map(td => td.textContent);
                if(!num || !id || !tank || !date) return {};
                return {
                    "id": id.replace(/\n/g, '').replace(/\t/g, '').replace(/\s/g, ''),
                    "tank": tank.replace(/\n/g, '').replace(/\t/g, '').replace(/\s/g, ''),
                    "Test Number": num.replace(/\n/g, '').replace(/\t/g, ''),
                    "Date Tested": date.replace(/\n/g, '').replace(/\t/g, '')
                };
            }).filter(row => row && row.tank && !row.tank.includes("RODI"))
        });

        console.log(reports.length," reports found, getting each of the reports data");
        let count = 1;
        let compiledReport = [];
        for(let report of reports) {
            console.log(`Getting report ${count} data`);
            await page.goto(`https://www.reef-zlements.com/icp-eos-analysis/?barcode=${report.id}`);
            await page.waitForSelector("#content");
            let results = await page.evaluate(() => {
                const rowNodeList = document.querySelectorAll("#content tr");
                const rowArray = Array.from(rowNodeList);
                return rowArray.map(tr => {
                    const dataNodeList = tr.querySelectorAll('td');
                    const dataArray = Array.from(dataNodeList);
                    const [key, value] = dataArray.map(td => td.textContent);
                    return [key, value];
                })
                .filter(([key, value]) => {
                    return key !== null && value !== null;
                });
            });
            console.log(results);
            results = Object.fromEntries(results);
            compiledReport.push({
                ...report,
                ...results
            });
        }
        
        console.log("all report data found, saving csv.");
        
        const csv = Papa.unparse(compiledReport);
        
        fs.writeFileSync("./output.csv", csv, "utf-8");
        console.log("DONE");
    } catch (err) {
        console.error(err);
    }
    process.exit();
})();

