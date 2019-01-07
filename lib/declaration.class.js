module.exports = class Declaration {
    constructor(parentSelector,selector,declarationProp,declarationVal,lineNumber,commentBefore,commentAfter){
        if(arguments.length < 5)
            throw new Error("Error: Declaration constructor expects at least 5 arguments")
        
        this.parentSelector = parentSelector.trim().replace(/\s+/,' ').toLowerCase() //Normalise selectors
        this.selector = selector.trim().replace(/\s+/,' ').toLowerCase()
        this.property = declarationProp.trim().toLowerCase()
        this.value = declarationVal.trim().replace(/\s+/,' ').replace(/(^|\s|\()0(px|r?em)/g,'$10').toLowerCase() //Handles 0 vs 0px
        this.declaration = this.property+": "+this.value+";"
        this.line = lineNumber || lineNumber === 0 ? lineNumber : Infinity
        this.commentBefore = commentBefore && commentBefore.trim() ? commentBefore.trim() : ''
        this.commentAfter = commentAfter && commentAfter.trim() ? commentAfter.trim() : ''
        
        if(this.parentSelector){
            this.parentType = 'unknown'
            let parentTypes = ['charset','custom-media','document','host','font-face','import','keyframes','media','namespace','page','supports']
            for(let i=0;i<parentTypes.length;i++){
                if(this.parentSelector.indexOf('@'+parentTypes[i])>-1){
                    this.parentType = parentTypes[i]
                    break
                }
            }
            if(this.parentType == 'unknown'){
                if(this.parentSelector.indexOf('-document')>-1) this.parentType = 'document'
                else if(this.parentSelector.indexOf('-keyframes')>-1) this.parentType = 'keyframes'
            }
        } else this.parentType = false

        this.fullSelector = (this.parentType ? this.parentSelector + ' { ' : '') + this.selector
        this.id = this.fullSelector + ' { ' + this.property + ': ' + this.value;
    }
};