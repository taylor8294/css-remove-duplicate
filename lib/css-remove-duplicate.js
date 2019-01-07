const css = require('css')
const fs = require('fs')
const path = require('path')
const exec = require('child_process').execSync
const beautify = require('js-beautify').css

const Declaration = require('./declaration.class')

const CSS_BEAUTIFY_OPTS = {
    indent_size:2,
    preserve_newlines: false,
    no_preserve_newlines: true,
    max_preserve_newlines: 1
}

module.exports = function(opts){
    var defaults = {
        "parentFile": "./parent.css",
        "childFile": "./child.css",
        "parentCSS": false,
        "childCSS": false,
        "outputDir": "./out",
        "outputFilename": false, //same as childFile
        "outputFileExt": ".out.css",
        "combineSelectors": true,
        "removeComments": false,
        "commentsSameLine": false,
        "removeEmptyLines": false,
        "verbose": false,
        "silent": false,
        "logResult": false,
        "returnString": false
    }
    var config = Object.assign(defaults,opts)
    
    var parentCSS = beautify(config.parentCSS ? config.parentCSS : fs.readFileSync(config.parentFile).toString(),CSS_BEAUTIFY_OPTS).replace(/(\r\n|\n)+/g, "$1");
    var childCSS = beautify(config.childCSS ? config.childCSS : fs.readFileSync(config.childFile).toString(),CSS_BEAUTIFY_OPTS).replace(/(\r\n|\n)+/g, "$1");

    var parentAst = css.parse(parentCSS)
    var childAst = css.parse(childCSS)

    if(config.verbose) console.log('Parsing parent declarations...')
    var parent = reduceStylesheetNode(parentAst.stylesheet, config.removeComments,config.commentsSameLine)
    if(config.verbose) console.log('Parsed!')
    //console.log(parent)

    if(config.verbose) console.log('Parsing child declarations...')
    var child = reduceStylesheetNode(childAst.stylesheet, config.removeComments,config.commentsSameLine)
    if(config.verbose) console.log('Parsed!')
    //console.log(child)

    if(config.verbose) console.log('Sorting parent declarations by selector for quick searching...')
    parent.declarations = parent.declarations.sort((a,b)=>{
        if(a.id < b.id) return -1
        if(a.id > b.id) return 1
        return 0
    })
    //console.log(parent.declarations)
    if(config.verbose) console.log('Sorted!')

    if(config.verbose) console.log('Building map of sorted parent list for quicker searching...')
    var indexMap = {}, starts = []
    parent.declarations.forEach((declaration,i)=>{
        let start = declaration.id.substring(0,3)
        if(!starts.includes(start)){
            starts.push(start)
            indexMap[start] = i
        }
    })
    if(config.verbose) console.log('Built!')

    if(config.verbose) console.log('Getting diff...')
    var diff = child.declarations.filter(declaration => {
        let i = -1
        let start = declaration.id.substring(0,3)
        if(starts.includes(start)) i = indexMap[start]
        else return true
        let keep = true;
        for(let n=parent.declarations.length;i<n;i++){
            let parentStart = parent.declarations[i].id.substring(0,3)
            if(parentStart !== start) break

            //@TODO: better selector comparison? Currently handles whitespace and letter casing, anything smarter needed?
            //@TODO: better declaration comparison? Currently handles whitespace, letter casing and 0 vs 0px.
            if(declaration.id === parent.declarations[i].id){
                keep = false
                break
            }
        }
        return keep
    })
    if(config.verbose || !config.silent)
        console.log('Removed '+(child.declarations.length - diff.length)+' of '+child.declarations.length+' CSS declarations ('+
            (((child.declarations.length - diff.length)/child.declarations.length).toFixed(2)*100)+'%)')
    //console.log(diff)

    function groupBy(objArray,prop){
        let groups = {};
        objArray.forEach(function(obj){
            let grp = groups[obj[prop]];
            if(grp) grp.push(obj);
            else groups[obj[prop]] = [obj]
        });
        return groups
    }
    if(config.verbose) console.log('Regrouping declarations by fullSelector...')
    var groupedByFullSelector = groupBy(diff,'fullSelector')
    var separateRules = []
    Object.keys(groupedByFullSelector).forEach(fullSelector => {
        let minLine = Infinity
        groupedByFullSelector[fullSelector].forEach(dec => {
            if(dec.line < minLine) minLine = dec.line
        })
        let parentSelector = groupedByFullSelector[fullSelector][0].parentSelector
        let selector = groupedByFullSelector[fullSelector][0].selector
        let groupingId = (groupedByFullSelector[fullSelector][0].parentType ? groupedByFullSelector[fullSelector][0].parentSelector+' { ' : '')+
            groupedByFullSelector[fullSelector].map(dec => dec.declaration).join('')
        separateRules.push({
            parentSelector: parentSelector,
            selector: selector,
            declarations: groupedByFullSelector[fullSelector],
            groupingId: groupingId,
            line: minLine
        })
    })
    if(config.verbose) console.log('Regrouped by fullSelector!')
    //console.log(verboseRules)

    var multiSelectorRules = []
    if(config.combineSelectors){
        if(config.verbose) console.log('Grouping selectors with same declarations and nesting...')
        var groupedByGroupingId = groupBy(separateRules,'groupingId')
        Object.keys(groupedByGroupingId).forEach(id => {
            let minLine = Infinity
            let parentType = groupedByGroupingId[id][0].declarations[0].parentType
            let parentSelector = groupedByGroupingId[id][0].declarations[0].parentSelector
            let decsStr = ""
            groupedByGroupingId[id][0].declarations.forEach(dec => {
                decsStr += (dec.commentBefore ? "/* "+ dec.commentBefore +" */\n" : "")+
                    dec.declaration+(dec.commentAfter ? " /* "+dec.commentAfter +" */" : "")
            })
            groupedByGroupingId[id] = groupedByGroupingId[id].map(rule => {
                if(rule.line < minLine) minLine = rule.line
                return rule.selector
            }).join(",\n");
            multiSelectorRules.push({
                parentSelector: parentSelector ? parentSelector : 'none',
                parentType: parentType,
                selectors: groupedByGroupingId[id],
                declarations: decsStr,
                line: minLine
            })
        })
        if(config.verbose) console.log('Grouped!')
        //console.log(groupedRules)
    } else multiSelectorRules = separateRules

    if(config.verbose) console.log('Finally, grouping rules by nesting...')
    var groupedByParentSelector = groupBy(multiSelectorRules,'parentSelector')
    var finalRules = groupedByParentSelector['none'] ? groupedByParentSelector['none'].map(groupedRule => {
        delete groupedRule['parentSelector']
        delete groupedRule['parentType']
        groupedRule.type = 'rule'
        return groupedRule
    }) : []
    Object.keys(groupedByParentSelector).forEach(pSelector => {
        if(pSelector === 'none') return
        let minLine = Infinity
        groupedByParentSelector[pSelector].forEach(multiSelectorRule => {
            if(multiSelectorRule.line < minLine) minLine = multiSelectorRule.line
        })
        finalRules.push({
            selector: pSelector,
            type: groupedByParentSelector[pSelector][0].parentType,
            rules: groupedByParentSelector[pSelector],
            line: minLine
        })
    })
    if(config.verbose) console.log('Grouped!')
    //console.log(finalRules)

    if(!config.removeComments){
        // Add top-level comments back in
        let comments = child.comments.filter(c => !c.parentSelector)
            finalRules = finalRules.concat(comments)
        // Add nested comments back in
        comments = child.comments.filter(c => !!c.parentSelector)
        comments.forEach(c => {
            for(let i=0;i<finalRules.length;i++){
                if(finalRules[i].selector === c.parentSelector){
                    finalRules[i].rules.push(c)
                    break
                }
            }
        })
    }
    
    // Compare at-rules
    var atRulesDiff = child.atRules.filter(atRule => {
        let keep = true;
        for(let i=0,n=parent.atRules.length;i<n;i++){
            if(parent.atRules[i].css.toLowerCase() === atRule.css.toLowerCase()){
                keep = false
                break
            }
        }
        return keep
    })
    finalRules = finalRules.concat(atRulesDiff)

    // Sort by original line
    finalRules = finalRules.sort((a,b)=>{
        if(a.line < b.line) return -1
        if(a.line > b.line) return 1
        return 0
    })
    finalRules.forEach((rule,i,arr) => {
        if(rule.rules)    
            arr[i].rules = arr[i].rules.sort((a,b)=>{
                if(a.line < b.line) return -1
                if(a.line > b.line) return 1
                return 0
            })
    })

    // Remove trailing slash from outputDir if present
    if(["/","\\"].includes(config.outputDir[config.outputDir.length-1]))
        config.outputDir = config.outputDir.substring(0,config.outputDir.length-1)
    if(config.verbose && !config.returnString) console.log('Creating css file in '+config.outputDir+'...')
    var result = "";
    finalRules.forEach(rule => {
        switch(rule.type){
            case 'rule':
                result += rule.selectors+" {\n  "+rule.declarations+"\n}\n"
                break
            case 'comment':
                result += "/* " + rule.comment +" */"
                break
            case 'document':
            case 'host':
            case 'media':
            case 'supports':
                result += rule.selector+" {\n"
                rule.rules.forEach(rl => {
                    if(rl.comment)
                        result += "/* " + rl.comment +" */"
                    else
                        result += rl.selectors+" {\n  "+rl.declarations+"\n}\n"
                })
                result += "}\n"
                break
            case 'charset':
            case 'custom-media':
            case 'font-face':
            case 'import':
            case 'keyframes':
            case 'namespace':
            case 'at-rule':
                result += rule.css+"\n"
                break
            case 'page':
                //treated like normal rules so dealt with above
                break
            default:
                //unknown?
        }
    })
    result = beautify(result,CSS_BEAUTIFY_OPTS).replace(/[ \t]+(\r\n|\n)/g,"$1")
    if(config.removeEmptyLines)
        result = result.replace(/(\r\n|\n){2,}/g, "$1")
    if(config.commentsSameLine)
        result = result.replace(/;(\r\n|\n) *\/\*/g,";  /*")
    if(config.logResult) console.log(result)
    if(config.returnString) return result
    else {
        if(!config.outputFilename){
            config.outputFilename = path.basename(config.childFile)
            if(config.outputFileExt)
                config.outputFilename = config.outputFilename.replace(".css",config.outputFileExt)
        }
        if(!fs.existsSync(config.outputDir)){
            if(process.platform === "win32") exec('md "' + config.outputDir + '"');
            else exec("mkdir -p '" + config.outputDir + "'");
        }
        fs.writeFileSync(config.outputDir+"/"+config.outputFilename, result)
        if(config.verbose || !config.silent)
            console.log('See '+(config.logResult ? 'also ' : '')+config.outputDir+"/"+config.outputFilename)
        //console.log(result)
        return true
    }
}

function ruleToDeclarationObjs(node, parentSelector, removeComments, commentsSameLine){
    if(!(node.type === 'rule')) throw new Error('Error: getDeclarationObjs works on nodes of type \'rule\' only')
    if(!parentSelector) parentSelector = ''
    let declarationObjs = [], commentForNext = ''
    node.selectors.forEach(selector => {
        node.declarations.forEach((declaration, i, nodeDecs) => {
            if(declaration.type == 'declaration') {
                declarationObjs.push(new Declaration(
                    parentSelector,
                    selector,
                    declaration.property,
                    declaration.value,
                    declaration.position.start.line,
                    commentForNext
                ))
                commentForNext = ''
            } else if(!removeComments){
                //Comment at declaration level, store within relevent declaration
                if(!commentsSameLine){
                    if(i < nodeDecs.length-1)
                        commentForNext += (commentForNext ? "*/\n/*" : '') +  declaration.comment.trim()
                    else if(i > 0 && declarationObjs.length)
                        declarationObjs[declarationObjs.length-1].commentAfter +=
                        (declarationObjs[declarationObjs.length-1].commentAfter ? "*/\n/*" : '') + declaration.comment.trim()
                } else {
                    if(i > 0 && declarationObjs.length)
                        declarationObjs[declarationObjs.length-1].commentAfter +=
                        (declarationObjs[declarationObjs.length-1].commentAfter ? "*/\n/*" : '') + declaration.comment.trim()
                    else if(i < nodeDecs.length-1)
                        commentForNext += (commentForNext ? "*/\n/*" : '') +  declaration.comment.trim()
                }
            }
        })
    })
    return declarationObjs
}

function reduceStylesheetNode(stylesheetNode,removeComments,commentsSameLine){
    let declarationObjs = [], comments = [], atRules = []
    stylesheetNode.rules.forEach(node => {
        let parentSelector = ''
        switch(node.type){
            case 'rule':
                if(node.declarations.some((dec => dec.type === 'declaration')))
                    declarationObjs = declarationObjs.concat(ruleToDeclarationObjs(node, '', removeComments,commentsSameLine))
                else {
                    // Must be a selector with all comments inside...
                    // Make whole thing a comment (comment out selector), join comment(s), and add to comments list
                    let c = node.selectors.join(",\n")+" {\n  "
                    node.declarations.forEach(commentNode => {
                        c += commentNode.comment+"\n  "
                    })
                    c = c.substring(0,c.length-2) + "}"
                    comments.push({
                        type: 'comment',
                        comment: c,
                        line: node.position.start.line
                    })
                }
                break
            case 'comment':
                comments.push({
                    type: 'comment',
                    comment: node.comment,
                    line: node.position.start.line
                })
                break
            case 'document':
                parentSelector = "@"+(node.vendor ? node.vendor : "")+"document "+node.document
                node.rules.forEach(rule => {
                    if(rule.type === 'rule')
                        declarationObjs = declarationObjs.concat(ruleToDeclarationObjs(rule, parentSelector, removeComments,commentsSameLine))
                    else // Must be a comment @TODO: fix positioning
                        comments.push({
                            type: 'comment',
                            comment: rule.comment,
                            parentSelector: parentSelector,
                            line: rule.position.start.line
                        })
                })
                break
            case 'host':
                node.rules.forEach(rule => {
                    if(rule.type === 'rule')
                        declarationObjs = declarationObjs.concat(ruleToDeclarationObjs(rule, '@host', removeComments,commentsSameLine))
                    else // Must be a comment @TODO: fix positioning
                        comments.push({
                            type: 'comment',
                            comment: rule.comment,
                            parentSelector: parentSelector,
                            line: rule.position.start.line
                        })
                })
                break
            case 'media':
                parentSelector = "@media "+node.media
                node.rules.forEach((rule, i) => {
                    if(rule.type === 'rule')
                        declarationObjs = declarationObjs.concat(ruleToDeclarationObjs(rule, parentSelector, removeComments,commentsSameLine))
                    else{
                        // Must be a comment @TODO: fix positioning
                        comments.push({
                            type: 'comment',
                            comment: rule.comment,
                            parentSelector: parentSelector,
                            line: rule.position.start.line
                        })
                    }
                })
                break
            case 'page':
                if(node.selectors.length == 0)
                    node.selectors = ['@page']
                else
                    node.selectors.forEach((selector,i,arr) => {
                        node.selectors[i] = "@page "+selector
                    })
                node.type = 'rule'
                declarationObjs = declarationObjs.concat(ruleToDeclarationObjs(node, '', removeComments,commentsSameLine))
                break
            case 'supports':
                parentSelector = "@supports "+node.supports
                node.rules.forEach(rule => {
                    if(rule.type === 'rule')
                        declarationObjs = declarationObjs.concat(ruleToDeclarationObjs(rule, parentSelector, removeComments,commentsSameLine))
                    else // Must be a comment @TODO: fix positioning
                        comments.push({
                            type: 'comment',
                            comment: rule.comment,
                            parentSelector: parentSelector,
                            line: rule.position.start.line
                        })
                })
                break
            case 'charset':
            case 'custom-media':
            case 'font-face':
            case 'import':
            case 'keyframes':
            case 'namespace':
                atRules.push({
                    type: 'at-rule',
                    css: nodeToCssString(node),
                    line: node.position.start.line
                })
                break
            default:
                //unknown type (no declaration types at top level)
        }
    })
    return {
        declarations: declarationObjs,
        comments: comments,
        atRules: atRules
    }
}

function nodeToCssString(node){
    let result = ""
    // if(Array.isArray(node)){
    //     node.forEach(nd => {
    //         result += toCSSString(nd)+"\n"
    //     })
    //     return result
    // }
    switch(node.type){
        case 'declaration':
            result += node.property+": "+node.value.replace(/(?<=^|\s|\()0px/g,'0')+";"
            break
        case 'rule':
            result += node.selectors.join(",\n")+" {\n"
            node.declarations.forEach(childNode => {
                result += "  "+nodeToCssString(childNode)+"\n"
            })
            result += "}"
            break
        case 'comment':
            result += "/* "+node.comment+" */"
            break
        case 'charset':
            result += "@charset "+node.charset+";"
            break
        case 'custom-media':
            result += "@custom-media "+node.name+" "+node.media+";"
            break
        case 'document':
            result += "@"+(node.vendor ? node.vendor : "")+"document "+node.document+" {\n"
            node.rules.forEach(rule => {
                result += nodeToCssString(rule)+"\n"
            })
            result += "}"
            break
        case 'font-face':
            result += "@font-face {\n"
            node.declarations.forEach(childNode => {
                result += "  "+nodeToCssString(childNode)+"\n"
            })
            result += "}"
            break
        case 'host':
            result += "@host {\n"
            node.rules.forEach(rule => {
                result += nodeToCssString(rule)+"\n"
            })
            result += "}"
            break
        case 'import':
            result += "@import "+node.import+";"
            break
        case 'keyframes':
            result += "@"+(node.vendor ? node.vendor : "")+"keyframes "+node.name+" {\n"
            node.keyframes.forEach(keyframe => {
                result += nodeToCssString(keyframe)+"\n"
            })
            result += "}"
            break
        case 'keyframe':
            result += node.values.join(",\n")+" {\n"
            node.declarations.forEach(childNode => {
                result += "  "+nodeToCssString(childNode)+"\n"
            })
            result += "}"
            break
        case 'media':
            result += "@media "+node.media+" {\n"
            node.rules.forEach(rule => {
                result += nodeToCssString(rule)+"\n"
            })
            result += "}"
            break
        case 'namespace':
            result += "@namespace "+node.namespace+";"
            break
        case 'page':
            result += "@page "+node.selectors.join(",\n")+" {\n"
            node.declarations.forEach(childNode => {
                result += "  "+nodeToCssString(childNode)+"\n"
            })
            result += "}"
            break
        case 'supports':
            result += "@supports "+node.supports+" {\n"
            node.rules.forEach(rule => {
                result += nodeToCssString(rule)+"\n"
            })
            result += "}"
            break
    }
    return result
}