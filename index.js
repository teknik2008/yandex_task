let parsePrimitive = (function () {
    function parsePromString(str) {
        let res = '';
        if (str == 'false' || str == 'true') {
            res = str == 'true' ? true : false
        } else if (/^[-+]?[0-9]*[.]?[0-9]+(?:[eE][-+]?[0-9]+)?$/.test(str)) {
            res = +str;
        } else if (str == 'null') {
            res = null;
        } else if (str == 'undefined') {
            res = void 0;
        } else {
            res = str;
        }
        return res;
    }

    function parserFromArray(arr, isClone) {
        for (let i = 0; i < arr.length; i++) {
            let value = arr[i];
            arr[i] = ParsePrimitive(arr[i], isClone);
        }
        return arr;
    }

    function parserFromObject(obj, isClone) {
        let res = isClone ? {} : obj
        let keys = Object.keys(obj);
        for (let i = 0; i < keys.length; i++) {
            let key = keys[i];
            let value = ParsePrimitive(obj[key], isClone);
            res[key] = value
        }
        return res;
    }
    /**
     * Ищитет примитивные строки типа true,false. Также числа,'undefined','null' ввиде строки и преобразует в соответствующий тип
     * - any - Любой тип данных
     * - isClone - клонировать ли объект/массив. Удобно с защищенными свойствами <false>
     * @param {any} any - Любой тип данных
     * @param {boolian} isClone - клонировать ли объект/массив. Удобно с защищенными свойствами
     * @returns 
     */
    return function ParsePrimitive(any, isClone = false) {
        let res;
        if (typeof any == 'string') {
            res = parsePromString(any);
        } else if (Array.isArray(any)) {
            res = parserFromArray(any, isClone);
        } else if (typeof any == 'undefined') {
            res = any;
        } else if (any === null) {
            res = any;
        } else if (typeof any == "object") {
            res = parserFromObject(any, isClone)
        } else if (typeof any == "function") {
            res = any;
        } else if (typeof any == "number") {
            res = any;
        } else {
            res = any;
        }
        return res;
    }
})()

class Validate {
    _parsePredicate(a, b, predicate) {
        if (predicate == 'eq') {
            return a === b;
        }
        if (predicate == 'gt') {
            return a > b
        }
        if (predicate == 'lt') {
            return a < b
        }
    }

    _sumNumbersStr(...args) {
        let sum = 0;
        args.map(arg => {
            sum += +arg;
        })
        return sum;
    }

    countWords(str = '', count = 0, predicate = 'eq') {
        let strArr = str.split(' ');
        let length = strArr.length;
        let state = this._parsePredicate(count, length, predicate);
        return state;
    }

    sumNumbersFromStr(str = '', sum = 0, predicate = 'eq') {
        let numbersStr = str.replace(/[^\d]/g, '');
        let numbersArr = numbersStr.split('');
        let sumStr = this._sumNumbersStr(...numbersArr);
        let state = this._parsePredicate(sumStr, sum, predicate);
        return state;
    }

    regExp(str = '', reStr = '', flags = '') {
        let re = new RegExp(reStr, flags);
        return re.test(str);
    }

}

class FormValidate {
    constructor(form, userParams = {}) {
        if (!this._isElement(form)) {
            return 'Форма должна быть элементом DOM'
        }
        this.formNode = form;
        this.controllFields = {};
        this.parsePrimitive = parsePrimitive;
        this.params = this._config(userParams);
        this._init()
    };

    _config(userParams) {
        let localParams = {
            validFields: [],
            validController: {},
            validInit: 'submit',
            reValidInit: 'focus',
        }
        let params = Object.assign(localParams, userParams)
        params._eventValid = {
            focusin: 'one',
            focusout: 'one',
            blur: 'one',
            keyup: 'one',
            submit: 'all',
        }
        params._setFields = ['phone', 'fio', 'email'];
        return params;
    };

    _isElement(obj) {
        return obj && obj.nodeType !== undefined;
    };

    _parseControllerFn(fnStr = '') {
        let parsePrimitive = this.parsePrimitive
        let controller = fnStr.match(/([A-z]+)\((.+)\)/);
        if (controller == null) {
            return {}
        }
        let fn = controller[1];
        let argsStr = controller[2] || '';
        let args = argsStr.split(',').map(item => parsePrimitive(item))
        return { fn, args };
    }
    /**
     * 
     * @param {object} field - объект поля содержащий правила обработки принятый из параметров пользователя
     * @param {object} validController - объект методов для валидации поля
     * @returns {array} - коллекция  методов обработки поля, сотоящая из объектов с полями errorTitle,controller,args
     */
    _fieldInitControllers(field, validController) {
        let controllers = [];
        let valid = field.valid;
        let _this = this;
        function parse(valid, errorTitle, controllers) {
            let { fn, args } = _this._parseControllerFn(valid);
            if (typeof validController[fn] == 'function') {
                let controller = validController[fn].bind(validController);
                controllers.push({ errorTitle, controller, args });
            }
            return controllers;
        }
        if (typeof valid == 'string') {
            let errorTitle = field.errorTitle || '';
            controllers = parse(valid, errorTitle, controllers);
        } else if (Array.isArray(valid)) {
            valid.forEach(item => {
                let errorTitle = item.errorTitle || field.errorTitle || '';
                let valid = item.type;
                controllers = parse(valid, errorTitle, controllers);
            }, this)
        } else if (typeof valid == 'function') {
            let controller = valid;
            let errorTitle = field.errorTitle || '';
            controllers.push({ errorTitle, controller });
        }
        return controllers;
    }

    _validFieldByName(name, controllField) {
        let formNode = this.formNode;
        controllField=controllField||this.controllFields[name];
        let controllers = controllField.controllers;
        let node = formNode.querySelector(`input[name="${name}"]`);
        let value = node.value;
        let errorTitle = '';
        let isValid = true;
        for (let q = 0; q < controllers.length; q++) {
            let controllerObj = controllers[q];
            let controller = controllerObj.controller;
            let args = controllerObj.args || [];
            let state = controller(value, ...args)
            if (state === false) {
                errorTitle = controllerObj.errorTitle;
                isValid = state;
                break;
            }
        }
        controllField.isValid = isValid;
        controllField.errorTitle = errorTitle;
        this._viewValidState(name, controllField)
        return { name, isValid, errorTitle }
    }

    _validFieldsAll() {
        let controllFields = this.controllFields;
        let errorFields = [];
        for (let key in controllFields) {
            let controllField = this.controllFields[key];
            let { name, isValid } = this._validFieldByName(key, controllField);
            if (isValid == false) {
                errorFields.push(name);
            }
        }
        return errorFields;
    }

    _validFields(e) {
        let typeEvent = e.type;
        let target = e.target;
        let eventValid = this.params._eventValid[typeEvent];
        if (eventValid == 'one') {
            let name = target.name;
            let controllField = this.controllFields[name];
            this._validFieldByName(name, controllField);
        }
        if (typeEvent == 'submit') {
            this._submit(e)

        }
    }

    _viewValidState(name, controllField) {
        let formNode = this.formNode;
        let input = formNode.querySelector(`input[name="${name}"]`);
        let errNode = formNode.querySelector(`span.error-title[name="${name}"]`);
        let { errorTitle, isValid } = controllField;
        let classState = isValid ? 'remove' : 'add';
        input.classList[classState]('error');
        errNode.textContent = errorTitle
    }

    _viewResultFormSubmit(resJson) {
        let formNode = this.formNode;
        let resultContainer = formNode.querySelector('#resultContainer');
        if (resJson.status == 'success') {
            resultContainer.classList.add('success')
            resultContainer.textContent = '';
            this._disabledForm();
        }
        else if (resJson.status == 'error') {
            resultContainer.classList.add('error');
            resultContainer.textContent = resJson.reason;
        }
        else if (resJson.status == 'progress') {
            resultContainer.classList.add('error');
            resultContainer.textContent = '';
        }
    }

    _disabledForm() {
        let formNode = this.formNode;
        let submitButton = formNode.querySelector('input[type="submit"]');
        submitButton.setAttribute('disabled', true)
    }

    _sleep(time = 1) {
        return new Promise(res => setTimeout(res, time))
    }

    async _submit(e) {
        e.preventDefault();
        let errorFields = this._validFieldsAll();
        if (errorFields.length > 0) return false;
        let formNode = this.formNode;
        let body = this._getFormFields();
        let method = formNode.getAttribute('method');
        let url = formNode.getAttribute('action');
        let resJson;
        try {
            let res = await window.fetch(url, { body, method });
            resJson = await res.json();
        } catch (e) {
            console.error(e)
        }
        if (resJson.status == 'progress') {
            let timeout = resJson.timeout;
            await this._sleep(timeout);
            await this._submit(e);
        }
        this._viewResultFormSubmit(resJson);

    }

    _init() {
        let validFields = this.params.validFields;
        let validController = this.params.validController;
        let formNode = this.formNode;
        let validInit = this.params.validInit;
        let reValidInit = this.params.reValidInit;
        let controllFields = {};
        validFields.forEach(field => {
            let name = field.name;
            let controllers = this._fieldInitControllers(field, validController);
            controllFields[name] = controllFields[name] || { isValid: true, value: '', errorTitle: '' }
            controllFields[name].controllers = controllers;

        }, this)
        this.controllFields = controllFields;
        formNode.addEventListener(validInit, this._validFields.bind(this))
        formNode.addEventListener(reValidInit, this._validFields.bind(this))
    }

    _getFormFields() {
        let formNode = this.formNode;
        let formData = new FormData(formNode);
        let fieldsData = {};
        for (let key of formData.keys()) {
            let value = formData.get(key)
            fieldsData[key] = value;
        }
        return fieldsData;
    }

    submit() {
        this.formNode.submit();
    }

    validate() {
        let errorFields = this._validFieldsAll();
        let isValid = errorFields.length == 0;
        return { errorFields, isValid }
    }

    getData() {
        return this._getFormFields()
    }

    setData(fieldsData = {}) {
        let _setFields = this.params._setFields;
        let formNode = this.formNode; 
        _setFields.map(name => {
            let value = fieldsData[name];
            if (typeof value !== 'string') {
                return;
            }
            let input = formNode.querySelector(`input[name="${name}"]`);
            input.value=value;
            this._validFieldByName(name)
        })
    }
};

let form = document.getElementById('myForm');
let valid = new Validate()

let MyForm = new FormValidate(form, {
    validFields: [
        {
            name: 'fio',
            valid: 'regExp(^([А-я]+ ){2}[А-я]+$)',
            errorTitle: 'ФИО должно содержать 3 слова'
        },
        {
            name: 'phone',
            valid: [
                {
                    type: 'regExp(^\\+7)',
                    errorTitle: 'Номер телефона должен начинатся с +7'
                },
                {
                    type: 'regExp(^\\+7\\(\\d{3}\\)\\d{3}-\\d{2}-\\d{2})',//+7(999)999-99-99
                    errorTitle: 'Номер телефона должен состоять из +7(999)999-99-99'
                },
                {
                    type: 'sumNumbersFromStr(30,lt)',//+7(999)999-99-99
                    errorTitle: 'Не нравится ваш номер, что в нем не то'
                }
            ]
        },
        {
            name: 'email',
            valid: (value) => valid.regExp(value, '.+@(ya\.ru|yandex\.ru|yandex\.ua|yandex\.by|yandex\.kz|yandex\.com)$'),//
            errorTitle: 'Укажите валидный email'
        }

    ],
    validController: valid,
    validInit: 'submit',
    reValidInit: 'keyup',
});




