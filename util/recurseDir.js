const fs = require('fs');
const path = require('path');

module.exports.find = (dir, filter, fileList = []) => {
    const files = fs.readdirSync(dir);

    files.forEach((file) => {
        const filePath = path.join(dir, file);
        const fileStat = fs.lstatSync(filePath);

        if (fileStat.isDirectory()) {
            sc.Utils.recurseDir(filePath, filter, fileList);
        } else if (filter.test(filePath)) {
            fileList.push(filePath);
        }
    });
    return fileList;
};
