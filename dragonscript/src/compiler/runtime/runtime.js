export default class RunTime {
    constructor() {
        //console is a string buffer to receive output from print statement
        this.console = []


        /*
        we will allow function declaration inside the function body, just like we can have
        block inside a block
        */
        this.callMap = [{}]

        this.returned_call = undefined
    }

    getAnonymousCall = () => {
        const functRoot = this.returned_call
        this.returned_call = undefined
        return functRoot
    }

    addAnonymousCall = (funcRoot) => {
        this.returned_call = funcRoot
    }

    addCallMap = () => {
        this.callMap.push({})
    }

    removeCallMap = () => {
        if (this.callMap.length > 1) {
            this.callMap.pop()
        }
    }

    getFunction = (funcName) => {
        for (let i = this.callMap.length - 1; i >= 0; i--) {
            const callMap = this.callMap[i]
            if (callMap[funcName]) {
                return callMap[funcName]
            }
        }
    }

    addFunction = (funcName, funcNode) => {
        const callMap = this.callMap[this.callMap.length - 1]
        callMap[funcName] = funcNode
    }

    bindVariable = (name, value, node) => {
        let currentEnv = node.env
        while (currentEnv) {
            //bug fix
            if (currentEnv.env.hasOwnProperty(name)) {
                break
            }

            //traverse backward to look up given variable
            currentEnv = currentEnv.previous
        }

        currentEnv.env[name] = value
    }

    getVariable = (name, node) => {
        const env = node["env"].env
        if (!env[name]) {
            throw new Error(`undefined variable with name ${name}`)
        }

        return env[name]
    }

    outputConsole = (content) => {
        this.console.push(content)
    }
}