<p align="center">
  <img src="./assets/logo.svg" width="240" alt="Cascade" />
</p>

<p align="center">
  <strong>自己的 VPN 路由器，一个浏览器标签页即可管理。</strong><br/>
  WireGuard 与 AmneziaWG —— 隧道、对端、策略路由、防火墙、NAT 与 TLS，
  全部集成在一个 Go 二进制文件中。
</p>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="README.ru.md">Русский</a> ·
  <a href="#致谢">致谢</a> ·
  <a href="README.upstream.md">上游文档</a>
</p>

---

## 这是什么

这是由我们维护的 **Cascade** 构建版本。Cascade 本身是一个 WireGuard 与
AmneziaWG 的自托管控制面板：创建隧道、下发客户端配置、按域名或国家路由流量，
并在一处管理防火墙与 TLS。

我们为它提供了**完整的俄文界面**（界面语言为英文与俄文），
以及一组**客户端路由修正**和**别名工具**，让国家级别的路由规则真正可用。
内核没有改动 —— 这仍是同一个 Cascade，只是磨平了我们在生产环境中遇到的棱角。

## 我们改了什么

### 俄文界面

整个管理面板已翻译：每个页面、每一条文案，46 个文件中共 1 427 个消息键。
这是真正的 i18n，而不是文本替换：键位于
`internal/frontend/i18n/messages.{en,ru}.json`，合并生成统一目录，缺失的条目
回退到英文。后端错误信息也走同一目录，因此校验错误同样是俄文。

### 客户端路由修正

有三个缺陷会让生成的客户端配置在不知不觉中出错。每一个都是通过测量发现的，
而不是猜测。

**关键服务不再被挤出隧道。** 国家级别名会产生过多路由，手机根本无法导入，
因此前缀会向外取整到 `/16`。取整无法区分「俄罗斯」与「紧邻俄罗斯」：对 RU
而言，它吞掉了 Telegram 公布的全部九个 IPv4 段以及 Meta 的段 —— 而这些都不是
俄罗斯地址 —— 于是这些服务走了直连，在限速的网络上直接卡死。现在，取整后会
触及受保护段的前缀将保持精确。在真实 RU 列表上的代价：2 053 → 2 101 条路由，
十二个受保护段全部留在隧道内。

取整是经过权衡的选择。改为对补集做归纳会把误差放到无害的方向，但测量否定了
这条路：俄罗斯地址空间过于碎片化，那样压缩会在 1% 阈值下把 61% 的俄罗斯地址
拉回隧道，2% 时则是 100%。

**IPv6 被收进隧道，而不是泄漏出去。** 出口只承载 IPv4。若照常下发 `::/0`，
客户端会把 IPv6 路由进一条无法承载它的隧道，应用随后回退到 IPv4，于是所有境外
流量都走 VPN。反过来，若去掉 `::/0`，IPv6 会直接泄漏到本地运营商 —— 而那里的
Google 服务被限速：YouTube 卡顿、Gemini 提示无网络、系统连通性探测失败，尽管
IPv4 一切正常。收进隧道是较小的恶。

**客户端 MTU 默认 1280**，不再假设路径为 1500 字节。通过带 DF 标志的 ping 对
在线客户端实测：笔记本可承载 1500 字节的外层数据包，印证了 80 字节的额外开销；
而一部手机只能承载 1360。若不设置 MTU，客户端会选 1420 并发出正好 1500 ——
WireGuard 会设置 DF，因此每个超长数据包都被丢弃：小请求正常，大文件传输和通话
不行。1280 是 IPv6 的最小值，也是能装进我们所测每一条路径的最大值。

### 别名工具

- 创建与编辑别名表单中的**精度选择器**（精确、`/18`、`/16`、`/14`），
  让国家级排除规则真正可用。
- **路由预览** —— `GET /api/aliases/:id/client-routes` 报告客户端实际会收到多少
  条路由、多少字节，并随精度变化实时刷新。
- 别名列表中的**一键刷新**，无需进入编辑即可从 RIPEstat 重新拉取生成的列表。

### 镜像元数据

镜像现在声明自己的 OCI 标签。作为叠加在另一个 Cascade 镜像之上的薄层，它们过去
会继承对方的 `source` 与 `version`，导致发布的包永远无法关联到本仓库。

## 快速开始

```bash
git clone https://github.com/smm959/cascade
cd cascade
docker build -t cascade .
```

配合数据卷运行 —— 面板、它的 SQLite 数据库与生成的隧道配置都存在这里：

```bash
docker run -d --name cascade \
  --cap-add NET_ADMIN --cap-add SYS_MODULE \
  --sysctl net.ipv4.ip_forward=1 \
  -p 8080:8080 \
  -v /opt/cascade/data:/etc/wireguard/data \
  cascade
```

打开 `http://<主机>:8080`，完成首次运行向导，Cascade 会为你创建第一个隧道接口。

详细部署、带 TLS 的反向代理以及 API 参考见 [`docs/`](docs/) —— 这些文档来自
上游项目，内容依然准确。

## 需要知道的事

- **AmneziaWG 的混淆参数是对称的。** `ContentPaddingAddition`、
  `RandomTrailers`、`Jc`、`S1–S4` 与 `H1–H4` 必须在服务端与客户端一致。只在
  服务端修改会断开所有尚未重新导入配置的客户端 —— 我们亲身验证过。请把这当作
  一次覆盖所有设备的协同操作，而不是在线微调。
- **IPv6 无法通过隧道工作。** 客户端会把它路由进去，然后在那里终止。这是有意
  的取舍，原因见上文。
- **重新导入客户端配置只会改变 MTU。** 如果某台设备运行良好，就不要动它：
  在 1500 字节的路径上 1420 更快，1280 只在路径更小的地方才有帮助。

## 致谢

本项目建立在他人的工作之上，其中没有一样是我们能据为己有的：

- **[JohnnyVBut](https://github.com/JohnnyVBut/cascade)** —— 最初的 Cascade 项目。
- **[Alex Nikonov](https://github.com/alexnikon)** —— 本构建所基于的上游 Cascade，
  也是 MIT 版权的持有者。
- **[AmneziaWG](https://github.com/amnezia-vpn)** —— 本项目所运行的协议与客户端。

我们新增的部分是上文所述的俄文界面、路由修正与别名工具。

## 许可证

沿用 MIT。原始版权声明保留在 [`LICENSE`](LICENSE) 中；另见
[`NOTICE`](NOTICE) 与 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。
