const { Builder} = require('selenium-webdriver');

const driver = {
    loadedDriver: null,
    initializeDriver: async function(){
        this.loadedDriver = await new Builder().forBrowser('chrome').build();
        this.loadedDriver.manage().window().maximize();
        // this.loadedDriver.manage().setTimeouts({ implicit: 15000 });
    },
    getDriver: function(){
        return this.loadedDriver;
    }
};

module.exports = driver;