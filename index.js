'use strict';

const cheerio = require('cheerio');
const fs = require('fs');
const jsonfile = require('jsonfile');
const _ = require('lodash');

function sortObject(o) {
  const sorted = {};
  const a = [];

  for (const key in o) {
    if (o.hasOwnProperty(key)) {
      a.push(key);
    }
  }

  a.sort();

  for (let key = 0; key < a.length; key++) {
    sorted[a[key]] = o[a[key]];
  }

  return sorted;
}

// First element is the preferred language
const langs = process.argv.slice(2);
const prefLang = langs[0];

const updateJSON = (jsonName, strings, cb) => {
  let newJSON = {};
  let prefJSON = {};
  if (strings.length) {
    for (let i = 0; i < strings.length; i++) {
      newJSON[strings[i]] = '';
      prefJSON[strings[i]] = strings[i];
    }
  }

  langs.forEach(lang => {
  	if (!fs.existsSync(`./client/assets/locales/${lang}`)) {
    	fs.mkdirSync(dir);
		}

    try {
      fs.accessSync(`./client/assets/locales/${lang}/${jsonName}`, fs.F_OK);
      const contents = jsonfile.readFileSync(`./client/assets/locales/${lang}/${jsonName}`);
      if (lang === prefLang) {
        let json = _.assign(prefJSON, contents);
        json = sortObject(json);
        jsonfile.writeFileSync(`./client/assets/locales/${lang}/${jsonName}`, json,
        { spaces: 2 });
        cb();
      } else {
        let json = _.assign(newJSON, contents);
        json = sortObject(json);
        jsonfile.writeFileSync(`./client/assets/locales/${lang}/${jsonName}`, json,
        { spaces: 2 });
        cb();
      }
    } catch (e) {
      if (lang === prefLang) {
        prefJSON = sortObject(prefJSON);
        jsonfile.writeFileSync(`./client/assets/locales/${langs[0]}/${jsonName}`, prefJSON,
        { spaces: 2 });
        cb();
      } else {
        newJSON = sortObject(newJSON);
        jsonfile.writeFileSync(`./client/assets/locales/${lang}/${jsonName}`, newJSON,
        { spaces: 2 });
        cb();
      }
    }
  });
};

const inspectHTML = (contents, file, cb) => {
  const $ = cheerio.load(contents);
  const all = [];
  for (const key in $('*')) {
    if ($('*').hasOwnProperty(key) && $('*')[key].attribs) {
      if ($('*')[key].attribs.hasOwnProperty('translate')) {
        all.push($('*')[key].children[0].data);
      }
      if ($('*')[key].attribs.hasOwnProperty('placeholder')) {
        if ($('*')[key].attribs.placeholder.indexOf('translate') > -1) {
          if ($('*')[key].attribs.placeholder.match(/'[^'\\]*(?:\\.[^'\\]*)*'/g)) {
            all.push($('*')[key].attribs.placeholder
              .match(/'[^'\\]*(?:\\.[^'\\]*)*'/g)[0].slice(1, -1));
          }
        }
      }
    }
  }

  const pathArr = file.split('/');
  let jsonName = '';
  // for (let i = 2; i < pathArr.length - 1; i++) {
    // jsonName = `${jsonName}${pathArr[i]}.`;
  // }
  if (pathArr.length <= 4) {
    jsonName = `${pathArr[2]}.`;
  } else {
    jsonName = `${pathArr[2]}.${pathArr[3]}.`;
  }
  if (all.length) {
    updateJSON(`${jsonName}json`, all, () => {
      cb();
    });
  } else {
    cb();
  }
};

const inspectJS = (contents, file, cb) => {
  const all = [];
  const match = contents.match(/(\$translate.instant\(')[^'\\]*(?:\\.[^'\\]*)*'/g);
  if (match) {
    for (let i = 0; i < match.length; i++) {
      all.push(match[i].slice(20, -1));
    }
  }
  const pathArr = file.split('/');

  let jsonName = '';
  // for (let i = 2; i < pathArr.length - 1; i++) {
    // jsonName = `${jsonName}${pathArr[i]}.`;
  // }

  if (pathArr.length <= 4) {
    jsonName = `${pathArr[2]}.`;
  } else {
    jsonName = `${pathArr[2]}.${pathArr[3]}.`;
  }

  if (all.length) {
    updateJSON(`${jsonName}json`, all, () => {
      cb();
    });
  } else {
    cb();
  }
};

const walk = (dir, done) => {
  let results = [];
  fs.readdir(dir, (err, list) => {
    if (err) return done(err);
    let i = 0;
    (function next() {
      let file = list[i++];
      if (!file) return done(null, results);
      file = `${dir}/${file}`;
      fs.stat(file, (err2, stat) => {
        if (stat && stat.isDirectory()) {
          walk(file, (err3, res) => {
            results = results.concat(res);
            next();
          });
        } else {
          results.push(file);
          next();
        }
      });
    })();
  });
};

walk('./client/app', (err, files) => {
  if (err) throw err;
  const htmlFiles = files.filter(file => file.substr(-5) === '.html');
  const jsFiles = files.filter(file => file.substr(-3) === '.js');

  let htmlCnt = 0;
  const htmlLen = htmlFiles.length;

  htmlFiles.forEach(file => fs.readFile(file, 'utf-8', (error, contents) => {
    inspectHTML(contents, file, () => {
      htmlCnt++;
      if (htmlLen === htmlCnt) {
        jsFiles.forEach(file2 => fs.readFile(file2, 'utf-8', (error2, contents2) => {
          inspectJS(contents2, file2, () => true);
        }));
      }
    });
  }));
});

walk('./client/components', (err, files) => {
  if (err) throw err;
  const htmlFiles = files.filter(file => file.substr(-5) === '.html');
  const jsFiles = files.filter(file => file.substr(-3) === '.js');

  let htmlCnt = 0;
  const htmlLen = htmlFiles.length;

  htmlFiles.forEach(file => fs.readFile(file, 'utf-8', (error, contents) => {
    inspectHTML(contents, file, () => {
      htmlCnt++;
      if (htmlLen === htmlCnt) {
        jsFiles.forEach(file2 => fs.readFile(file2, 'utf-8', (error2, contents2) => {
          inspectJS(contents2, file2, () => true);
        }));
      }
    });
  }));
});
