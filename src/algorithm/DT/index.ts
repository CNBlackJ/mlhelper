// @ts-check
import * as fs from 'fs';
import {Repeat,List} from 'immutable';

interface ClassCount {
    [index: string]: number;
}

/**
 * 计算香农熵 Calculating Shannon entropy
 * 
 * @param {Array<Array<any>>} dataSet 
 * @returns {number} 
 */
function calShannoEnt(dataSet: Array<Array<any>>): number{
    let numEntries = dataSet.length;
    let labelCounts:ClassCount = {};

    dataSet.forEach(v=>{
        let label = v[v.length-1];
        if(label in labelCounts){
            return labelCounts[label] += 1;
        }
        
        labelCounts[label] = 1;
    });
    let shannoEnt = 0.0;
    for(let label in labelCounts){
        let prob = labelCounts[label]/numEntries;
        shannoEnt -= prob * Math.log2(prob);
        
    }
    return shannoEnt;
}

/**
 * 划分数据集 Partition dataset
 * 
 * @param {array} dataSet 原始数据集 Raw data set
 * @param {number} axis 划分特征 which feature to partition
 * @param {any} value 特征值 the value of the feature to partition
 * @returns {array} 划分后的数据集 the partition result.
 */
function splitDataSet(dataSet: Array<Array<any>>,axis: number,value: any): Array<Array<any>>{
    let retDataSet = dataSet.reduce((pre,cur)=>{
        let curList = List(cur);
        if(cur[axis] === value){
            pre.push(curList.splice(axis,1).toArray());
        }
        return pre;
    },[]);
    return retDataSet;    
}

/**
 * 选择最好的划分特征 choose the best feature to partition.
 * 
 * @param {Array<Array<any>>} dataSet 
 * @returns {number} 
 */
function chooseBestLabelToSplit(dataSet: Array<Array<any>>): number{
    let numLables = dataSet[0].length - 1,
        baseEntropy = calShannoEnt(dataSet),
        bestInfoGain = 0.0,
        bestLabel = -1;
    
    for(let i=0; i<numLables; i++){
        let featList = dataSet.map(v=>v[i]),
            uniqueVals = [...new Set(featList)],
            newEntropy = 0.0;
        uniqueVals.forEach((v,index)=>{
            let subDataSet = splitDataSet(dataSet,i,v),
                prob = subDataSet.length/dataSet.length;
            newEntropy += prob * calShannoEnt(subDataSet);
        });
        let infoGain = baseEntropy - newEntropy;
        
        if(infoGain > bestInfoGain){
            bestInfoGain = infoGain;
            bestLabel = i;
        }
    }
    
    return bestLabel;
}

/**
 * 多数决策，当子数据集只有一个特征，且各个实例所属分类仍旧不同时调用此方法 The majority decision, only one set of features when the data, and each instance belongs to classification is still not at the same time this method is called
 * 
 * @param {Array<string>} classList 
 * @returns {string} 
 */
function majorityCnt(classList: Array<string>): string{
    let classCount:ClassCount = {};
    classList.forEach((v,i)=>{
        if(v in classCount){
            return classCount[v] += 1;
        }
        classCount[v] = 1;
    })
    let sortedClassCount = Object.keys(classCount).sort((a,b)=>classCount[b]-classCount[a]);

    return sortedClassCount[0];
}

/**
 * 构建决策树 create decision tree.
 * 
 * @param {Array<Array<any>>} dataSet for training.
 * @param {Array<string>} labels the classes of training data.
 * @returns {object} 
 */
function createTree(dataSet: Array<Array<any>>,labels: Array<string>): object{
    let classList = dataSet.map(v=>v[v.length-1]),
        uniqueClasses = [...new Set(classList)].length;
    if(uniqueClasses === 1){
        return classList[0];
    }
    if(dataSet[0].length === 1){
        return majorityCnt(classList);
    }
    let bestFeat = chooseBestLabelToSplit(dataSet),
        bestFeatLabel = labels[bestFeat];
    let resultTree = {
        [bestFeatLabel]: {}
    }
    labels.splice(bestFeat,1);
    let featValues = dataSet.map(v=>v[bestFeat]),
        uniqueVals = [...new Set(featValues)];
    uniqueVals.forEach(v=>{
        let subLabels = [...labels],
            subDataSet = splitDataSet(dataSet,bestFeat,v);
        resultTree[bestFeatLabel][v] = createTree(subDataSet,subLabels);
    })

    return resultTree;
}

/**
 * 判断测试数据分类 class the testing data.
 * 
 * @param {object} inputTree 决策树对象  the decision tree.
 * @param {array} featLabels 特征名称向量  the vector of feature names.
 * @param {array} testVec 测试向量  the vector for testing.
 * @returns 测试数据的分类
 */
function classify(inputTree: object,featLabels: Array<string>,testVec: Array<any>): any{
    let firstStr = Object.keys(inputTree)[0],
        secondDict = inputTree[firstStr],
        featIndex = featLabels.indexOf(firstStr);
        
    let resultClass;
    for(let key of Object.keys(secondDict)){
        
        if(testVec[featIndex] === key){
            if(typeof secondDict[key] === 'object'){
                resultClass = classify(secondDict[key],featLabels,testVec);
            } else{
                resultClass = secondDict[key];
                break;
            }
        }
    }
    return resultClass;
}

class DT {
    tree: object;
    constructor(public dataSet: Array<Array<any>>,public labels: Array<string>,alg: string="ID3"){
        this.tree = createTree(dataSet,[...labels]);
    }
    getTree(): object{
        return this.tree;
    }
    // 根据实例构造的决策树进行测试
    classify(featLabels: Array<string>,testVec: Array<any>): any{
        return classify(this.tree,featLabels,testVec);
    }
    // 将决策树存入文件
    storeTree(filePath: string){
        let jsonTree = JSON.stringify(this.tree);
        return new Promise((resolve,reject)=>{
            fs.writeFile(filePath,jsonTree,err=>{
                if(err){
                    return reject(err);
                }
                resolve();
            });
        })
    }
    // 根据提供的决策树进行测试，静态方法，无需实例化构造决策树
    static classifyFromTree(inputTree: object,featLabels: Array<string>,testVec: Array<any>): any{
        return classify(inputTree,featLabels,testVec);
    }
}

export default DT;