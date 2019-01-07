var fs = require('fs')
var CSSRemoveDuplicate = require('./lib/css-remove-duplicate')

var opts = false
var args = process.argv.slice(2);
if(args.length == 1)
    opts = require(args[0])
else if(args.length > 1){
    for(let i=0;i<args.length; i++){
        if(['-c','--config'].includes(args[i]) && i<args.length-1){
            let configPath = args[i+1]
            if(configPath.substring(0,2) !== './')
                configPath = './'+configPath
            opts = require(configPath)
        }
    }
}
if(!opts){
    if(fs.existsSync('./config.json') || fs.existsSync('./config.js'))
        opts = require('./config')
    else opts = {}
}
if(opts.hasOwnProperty('childFile') && opts.childFile.indexOf("*") > -1){
    let config = Object.assign({},opts)
    var glob = require("glob")
    glob(opts.childFile, function (err, files) {
        files.forEach((file)=>{
            config.childFile = file
            CSSRemoveDuplicate(config)
        })
    })
}
else CSSRemoveDuplicate(opts)