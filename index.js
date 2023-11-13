require('dotenv').config();
const fs = require('fs');
const { By, until } = require('selenium-webdriver');
const driver = require('./driver.js');
const config = require('./config.json');

var failedProfiles = [];
var sendRequestProfiles = [];
var alreadyConnectedProfiles = [];

function readProfileLinksFromFileOrAPI(filePath){
    var profileLinks = [];
    const fileContent = fs.readFileSync(filePath, 'utf8');
    fileContent.split('\n').forEach(line => {
        if (line.trim()) {
            profileLinks.push(line.trim());
        }
    });
    return profileLinks;
}


function readLoginCredentialsFromEnv() {
  const email = process.env.EMAIL;
  const password = process.env.PASSWORD;
  return { email, password };
}

async function loginToLinkedIn(email, password) {
    try {
        await driver.getDriver().get('https://www.linkedin.com/login');
        await driver.getDriver().findElement(By.id('username')).sendKeys(email);
        await driver.getDriver().findElement(By.id('password')).sendKeys(password);    
        await driver.getDriver().findElement(By.xpath("//button[contains(text(), 'Sign in')]")).click();
        await driver.getDriver().wait(until.urlContains('feed'), 20000);
        console.log('LinkedIn Login Succesfully.');
    }catch(e) {
        console.log('LinkedIn Login Failed.');
    }
}

async function visitEachProfile(profileLinks) {
    try {
        for (const profile of profileLinks) {
            if(! await isValidLinkedInURL(profile)){
                await handleFailedProfiles(profile);
                continue;
            }
            await visitProfilePage(profile);            
        }
    }catch(e) {
        console.log(e);
    }
}

async function visitProfilePage(profileLink){
    try {
        await driver.getDriver().get(profileLink);
        await driver.getDriver().wait(until.urlContains(profileLink), 10000);
        await connectToProfile(profileLink);
    } catch(e) {
        await handleFailedProfiles(profileLink);
    }
}

async function connectToProfile(profileLink) {
    try {
        if(await isAlreadyConnected()) {
            handleAlreadyConnectedProfile(profileLink);
        }else {
            sendConnectionRequest(profileLink);
        }        
    } catch(e) {
        await handleFailedProfiles(profileLink);
    }
}

async function sendConnectionRequest(profileLink) {
    try {
        const divElement = await driver.getDriver().findElement(By.className('pvs-profile-actions'));
        await divElement.findElement(By.xpath('.//button[contains(., "Connect")]')).click();
        
        var divModelElement = await driver.getDriver().wait(until.elementLocated(By.xpath(`//div[@aria-labelledby="send-invite-modal"]`)), 10000);
        await divModelElement.findElement(By.xpath('.//button[contains(., "Add a note")]')).click();
        
        divModelElement = await driver.getDriver().wait(until.elementLocated(By.xpath(`//div[@aria-labelledby="send-invite-modal"]`)), 10000);
        await divModelElement.findElement(By.xpath('.//textarea')).sendKeys(config.newConnectionCustomMessage);
        await divModelElement.findElement(By.xpath('.//button[contains(., "Send")]')).click();
        await handleSendRequestProfiles(profileLink);
    } catch(e) {
        await handleFailedProfiles(profileLink);
    }
}

async function isAlreadyConnected() {
    const spanElement = await driver.getDriver().findElement(By.className('dist-value'));
    const spanText = await spanElement.getText();
    return (spanText === '1st') ? true : false;
}

async function generateTestReport(profileLinks) {
    var reportContent = null;

    reportContent = 'Total('+profileLinks.length+') Profile Processed. \n';
    reportContent += '\n\n';
    reportContent += 'Total('+sendRequestProfiles.length+') Profiles successfully sent request. \n';
    reportContent += sendRequestProfiles.join('\n');
    reportContent += '\n\n';
    reportContent += 'Total('+failedProfiles.length+') Failed Profiles. \n';
    reportContent += failedProfiles.join('\n');
    reportContent += '\n\n';
    reportContent += 'Total('+alreadyConnectedProfiles.length+') Already Connected Profiles. \n';
    reportContent += alreadyConnectedProfiles.join('\n');
    reportContent += '\n\n';

    fs.writeFile('report.txt', reportContent, function(err) {
        if (err) throw err;
        console.log('Report Generated.');
    });
}

async function isValidLinkedInURL(url) {
    const regex = /^https?:\/\/(www\.)?linkedin\.com\/in\/.+\/?$/;
    return regex.test(url);
}

async function handleFailedProfiles(profileLink) {
    if (!failedProfiles.includes(profileLink)) {
        failedProfiles.push(profileLink);
    }
}

async function handleAlreadyConnectedProfile(profileLink) {
    if (!alreadyConnectedProfiles.includes(profileLink)) {
        alreadyConnectedProfiles.push(profileLink);
    }
}

async function handleSendRequestProfiles(profileLink) {
    if (!sendRequestProfiles.includes(profileLink)) {
        sendRequestProfiles.push(profileLink);
    }
}

async function main() {
    try {
        const profileLinks = readProfileLinksFromFileOrAPI('./profile_links.txt');
        if (profileLinks.length == 0) {
            throw new Error('No Profile Links Found.');
        }
        const { email, password } = readLoginCredentialsFromEnv();
        if(!email){
            throw new Error('Specify email in env file.');
        }
        if(!password){
            throw new Error('Specify password in env file.');
        }

        await driver.initializeDriver();
        await loginToLinkedIn(email, password);
        await visitEachProfile(profileLinks);
        await generateTestReport(profileLinks);
        await driver.getDriver().quit();
    } catch(e) {
        console.log(e.message);
    }
}

main();