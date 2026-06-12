// 生成 bcrypt 密码哈希
const bcrypt = require('bcrypt');

const password = 'CQHcqh2002.';
const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error('Error:', err);
    return;
  }
  console.log('Password:', password);
  console.log('Hash:', hash);
  
  // 验证
  bcrypt.compare(password, hash, (err, result) => {
    if (err) {
      console.error('Verify Error:', err);
      return;
    }
    console.log('Verify Result:', result);
  });
});
