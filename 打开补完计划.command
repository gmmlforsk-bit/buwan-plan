#!/bin/zsh
cd -- "${0:A:h}" || exit 1
port=18765
site="http://127.0.0.1:$port"
job="local.buwan-plan.site-$port"
ready() {
  /usr/bin/curl --noproxy '*' -fsS --max-time 2 "$site/api/bootstrap" 2>/dev/null | /usr/bin/grep -q '"personas"'
}
if ready; then
  /usr/bin/open "$site/"
  exit $?
fi
if /usr/sbin/lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
  print "端口 $port 正被其他程序使用，暂时无法打开补完计划。"
  exit 1
fi
for python in "$(command -v python3)" /opt/homebrew/bin/python3 /usr/local/bin/python3 /usr/bin/python3; do
  [[ -x "$python" ]] && "$python" -c 'import sys; sys.exit(sys.version_info < (3, 10))' 2>/dev/null && break
  python=''
done
if [[ -z "$python" ]]; then
  print "启动补完计划需要 Python 3.10 或更高版本。"
  exit 1
fi
# Keep the site available after the launch window closes.
/bin/launchctl submit -l "$job" -- "$python" -B "$PWD/server.py" "$port" || exit 1
for attempt in {1..40}; do
  if ready; then
    /usr/bin/open "$site/"
    exit $?
  fi
  sleep 0.25
done
print "本机服务尚未就绪。请在此目录运行以下命令查看启动信息："
print "python3 server.py $port"
exit 1
