// Facebook is flattening Level 3 comments. This means that `parent.id` for a comment replaying to a
// level 3  comment will be a level 2  comment  (the parent of the actual level 3  comment which the
// user replay to).  To get the full context, we need all level 3  comments ordered by created_time.
// TODO: Edit comment above to explain the weird way Facebook API for comment is operating.

import fs from 'fs'
import express from 'express'
const app = express()
app.use(express.json())

// =============== Util Functions ================================================================//

const read = (name, ex = 'txt') => fs.readFileSync(`./data/${name}.${ex}`, 'utf-8')
const write = (name, data, ex = 'txt') => fs.writeFileSync(`./data/${name}.${ex}`, data, 'utf-8')
const read_scrt = name => fs.readFileSync(`/run/secrets/${name}`, 'utf-8').trim()
const LOG = (e) => { console.log(`🚨 ERROR 🚨 : ${e}`); return true }
const process_comment = (a, b, c) => console.log(`${a} ${b} ${c}`)
//const format_mssg = (cmt) => `<<<${cmt.created_time}>>> <<<${cmt.from?.name}>>>: ${cmt.message}`


// =============== Server Loading section ========================================================//
// In this section the server should fail in case of error and not startup. ======================//

const token = read_scrt('fb_page_access_token')
token.length > 0 || LOG('Page Token is empty.')
const fb_url = process.env.FACEBOOK_API_URL
fb_url.length > 0 || LOG('FACEBOOK_API_URL is empty')
let page_content = JSON.parse(read('page_content', 'json'))
if (Object.keys(page_content).length === 0) {
  console.log('page_content file empty. fetching fro Facebook.')
  const ret = await fetch(`${fb_url}&access_token=${token}`)
  if (!ret.ok && LOG(`1 ${ret.status} ${ret.statusText}`)) process.exit(1)
  page_content = await ret.json()
  write('page_content', JSON.stringify(page_content, null, 2), 'json')
}
console.log(page_content)

// =============== Endpoints =====================================================================//
// In this section the server should keep running and give the best answer it can. ===============//

app.post('/', async (req, res) => {
  res.status(200).send('EVENT_RECEIVED')
  console.dir(req.body, { depth: null, colors: true });
  if (req.body.object !== 'page' && LOG(`2 ${req.body.object}`)) return
  req.body.entry.forEach((entry) => {
    entry.changes.forEach((change) => {
      const { value, field } = change
      if (field !== 'feed' && LOG(1))         return
      if (value?.item === 'status' && LOG(2)) return // 'status' means a post
      if (value?.item === 'comment' && value.from?.id !== entry.id && value.verb === 'add')
        process_comment(value.comment_id, value.parent_id, value.post_id)
    })
  })
})


app.listen(3210, () => console.log('Server Start Up'))
