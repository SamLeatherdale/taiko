#! /usr/bin/env node

const runFile = require('./runFile');
const fs = require('fs');
const program = require('commander');
const repl = require('../lib/repl');
const { isTaikoRunner } = require('../lib/util');
const devices = require('../lib/data/devices').default;
let repl_mode = false;
let taiko;

function printVersion() {
    const packageJson = require('../package.json');
    let hash = 'RELEASE';
    if (packageJson._resolved) hash = packageJson._resolved.split('#')[1];
    return `Version: ${packageJson.version} (Chromium: ${
        packageJson.taiko.chromium_version
    }) ${hash}`;
}

async function exitOnUnhandledFailures(e) {
    if (!repl_mode) {
        console.error(e);
        if (taiko && await taiko.client()) await taiko.closeBrowser();
        process.exit(1);
    }
}

process.on('unhandledRejection', exitOnUnhandledFailures);
process.on('uncaughtException', exitOnUnhandledFailures);

function validate(file) {
    if (!file.endsWith('.js')) {
        console.log('Invalid file extension. Only javascript files are accepted.');
        process.exit(1);
    }
    if (!fs.existsSync(file)) {
        console.log('File does not exist.');
        process.exit(1);
    }
}

function setupEmulateDevice(device) {
    if (devices.hasOwnProperty(device))
        process.env['TAIKO_EMULATE_DEVICE'] = device;
    else {
        console.log(`Invalid value ${device} for --emulate-device`);
        console.log(`Available devices: ${Object.keys(devices).join(', ')}`);
        process.exit(1);
    }
}

function setPluginNameInEnv(pluginName) {
    process.env.TAIKO_PLUGIN = pluginName;
    return pluginName;
}

if (isTaikoRunner(process.argv[1])) {
    program
        .version(printVersion(), '-v, --version')
        .usage(
            `[options]
       taiko <file> [options]`
        )
        .option(
            '-o, --observe',
            `enables headful mode and runs script with 3000ms delay by default.
        \t\t\tpass --wait-time option to override the default 3000ms\n`
        )
        .option(
            '-l, --load',
            'run the given file and start the repl to record further steps.\n'
        )
        .option(
            '-w, --wait-time <time in ms>',
            'runs script with provided delay\n',
            parseInt
        )
        .option(
            '--emulate-device <device>',
            'Allows to simulate device viewport. Visit https://github.com/getgauge/taiko/blob/master/lib/devices.js for all the available devices\n',
            setupEmulateDevice
        )
        .option(
            '--plugin <plugin1,plugin2...>',
            'Load the taiko plugin.', setPluginNameInEnv
        )
        .action(function ( ) {
            taiko = require('../lib/taiko');
            if (program.args.length) {
                const fileName = program.args[0];
                validate(fileName);
                const observe = Boolean(program.observe || program.slowMod);
                if (program.load) {
                    runFile(fileName, true, program.waitTime, fileName => {
                        return new Promise(resolve => {
                            repl_mode = true;
                            repl.initialize(taiko, fileName).then(r => {
                                let listeners = r.listeners('exit');
                                r.removeAllListeners('exit');
                                r.on('exit', () => {
                                    listeners.forEach(l => r.addListener('exit', l));
                                    resolve();
                                });
                            });
                        });
                    });
                } else {
                    runFile(taiko, fileName, observe, program.waitTime);
                }
            } else {
                repl_mode = true;
                repl.initialize(taiko);
            }
        });
    program.unknownOption = option => {
        console.error('error: unknown option `%s', option);
        program.outputHelp();
        process.exit(1);
    };
    program.parse(process.argv);
} else {
    module.exports = require('../lib/taiko');
}