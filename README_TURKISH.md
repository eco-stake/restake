# [REStake](https://restake.app)

REStake, delegatorlerin validatorlerine stake ödüllerini yeniden stake etmesine izin vermelerine olanak tanır. REStake validatorlerin bir komut dosyasını çalıştırarak kendilerine verilen delegeleri bulmaları ve restake işlemlerini otomatik olarak yapmalarını sağlar.

REStake, aynı zamanda kullanışlı bir stake etme aracıdır. Ödüllerinizi tek tek ya da toplu olarak telep etmenize ve yeniden stake etmenizi sağlar. Bu da işlem ücretlerinden ve zamandan tasarruf etmenizi sağlar ve daha birçok özellik de planlanmıştır.

[![](./docs/screenshot.png)](https://restake.app)

[restake.app](https://restake.app)'ı deneyin.

## Nasıl çalışır / Authz (Yetkilendirme)

Authz, Tendermint zincirleri için başka bir cüzdana sizin için belirli işlemleri gerçekleştirmesi için izin vermenizi sağlayan yeni bir özelliktir.

Bu işlemler, stake eden adına stake alan tarafından gönderilir, yani valiatorler fee ücretini gönderecek ve ödeyecektir. Bu işlemler cüzdanınızı etkiler, ödül talep etme vb. yani siz restake işlemini kapatmadığınız sürece kazandığınız ödüller sürekli restake edilir.

REStake, özellikle bir validatore `Delegate` işlemlerini yalnızca validatorleriniz yapmasına izin vermenizi sağlar. Validator başka herhangi bir işlem türü gönderemez ya da cüzdanınıza herhangi bir erişimi yoktur. Bunu normal olarak Keplr kullanarak yetkilendiriyorsunuz. REStake artık oto-stake için bir `çekme` izni gerektirmiyor.

Doğrulayıcının delegelerini otomatik olarak aramasını sağlayan bir komut dosyası da sağlanmıştır, gerekli ödemeler için her birini kontrol edin ve varsa, talep ve işlemleri tek bir işlemde onlar adına gerçekleştirin. Bu script günlük olarak çalıştırılmalıdır ve çalıştıracağınız saat [operatörünüzü eklediğinizde](#operat%C3%B6r-olun) belirtilebilir.

## Kısıtlamalar

Yazılı olarak, Ledger, Authz (Yetkilendirmeyi) etkinleştirmek için gerekli işlemleri gönderemiyor. Bu tamamen işlemlerin bir Ledger cihazına gönderilme şeklinden kaynaklanmaktadır ve yakında bir geçici çözüm mümkün olabilecektir.

Authz da henüz tam olarak desteklenmemektedir. Birçok zincir henüz güncellenmedi. REStake UI, kullanışlı manuel birleştirme özelliklerine sahip bir manuel stake uygulaması olmaya geri dönecek.

Şu anda REStake, Keplr'ın tarayıcı uzantısı sürümüne ihtiyaç duyuyor, ancak WalletConnect ve Keplr iOS işlevselliği en kısa sürede eklenecek.

## Operatör olun

Bot cüzdanınızı kurun
Otomatik komut dosyasını ayarlayın
Komut dosyasını bir çizelgede çalıştırmak için bir cron veya zamanlayıcı kurun
Operatörünüzü Doğrulayıcı Kayıt Defterine (Validator Registry) gönderin.

### Sıcak bir cüzdan kurun

Stake işlemlerini otomatik olarak gerçekleştirmek için kullanacağınız yeni bir sıcak cüzdan oluşturun. Komut dosyasına anımsatıcının (mnemonic) sağlanması gerekecek, bu nedenle özel bir cüzdan kullanın ve yalnızca işlem ücretleri için yeterli parayı saklayın. Burada gerekli olan SADECE menemonic, sıcak cüzdan içindir, validatorünüze ait cüzdan mnemoniclerinizi hiçbir yere yazmayın.

Birden çok Cosmos zinciri için yalnızca tek bir anımsatıcıya ihtiyacınız vardır ve komut dosyası, eşleşen bir bot adresi için [networks.json](./src/networks.json) dosyasındaki her ağı kontrol eder.

#### Türetme Yolları (ÖNEMLİ)

Şu anda, REStake otomatik stake komut dosyası varsayılan olarak standart 118 türetme yolunu kullanır. Bazı ağlar farklı bir yolu tercih eder ve Keplr gibi uygulamalar bunu izin verecektir. Otomatik stake komutunun kullandığı adres Keplr ile eşleşmeyebilir.

118 yolunu kullanan mevcut operatörler olduğundan, operatörlerin yükseltme yapmak istediklerinde doğru yolu seçmeleri gerekecektir. Yeni operatörler, stake almadan önce doğru yolu kullanmalıdır.

Doğru yol, bir [yapılandırma geçersiz kılma](https://github.com/AnatolianTeam/restake/edit/master/README_TURKISH.md#restakei-%C3%B6zelle%C5%9Ftirin-ve-nodeunuzu-kullan%C4%B1n)  dosyası kullanılarak iki yoldan biriyle ayarlanabilir. `"correctSlip44": true`, Zincir Kaydı'nda tanımlanan slip44'ü kullanır. Alternatif olarak `"slip44": 69` kullanarak belirli bir yol ayarlayın. Mümkünse `"correctSlip44": true` kullanmalısınız.

```jsonc
{
  "desmos": {
    "prettyName": "Desmos 852",
    "autostake": {
      "correctSlip44": true
    }
  }
}
```

Gelecekte, `correctSlip44` varsayılan olacak ve 118 yolunu kullanmak istiyorsanız `slip44`'ü açıkça ayarlamanız gerekecek.

### Oto-stake komut dosyasını ayarlama

Otomatik ayırma komut dosyasını `docker-compose` ya da doğrudan `npm` kullanarak çalıştırabilirsiniz. Her iki durumda da anımsatıcınızı bir `MNEMONIC` ortam değişkeninde sağlamanız gerekecektir.

#### Docker Compose için Talimatlar

##### Docker ve Docker Compose Yükleme

En iyisi Docker resmi kılavuzlarını takip etmektir. Önce Docker'ı, ardından Docker Compose'u yükleyin. Son sürümlerde, Docker ve Docker Compose tek bir kurulumda birleştirilebilir.

Docker: [docs.docker.com/get-docker](https://docs.docker.com/get-docker/)

Docker Compose: [docs.docker.com/compose/install](https://docs.docker.com/compose/install/)

##### Depoyu klonlama ve .env'yi kurma

Depoyu klonlayın ve anımsatıcınız (menemonic kelimeleriniz) için hazır olan örnek .env dosyasını kopyalayın.

```bash
git clone https://github.com/eco-stake/restake
cd restake
cp .env.sample .env
```

**Yeni .env dosyanıza anımsatıcı kelimelerinizi yazın.**

#### NPM için Talimatlar

##### nodejs@v18 yükleme

```bash
curl -sL https://deb.nodesource.com/setup_18.x -o /tmp/nodesource_setup.sh
# read the script file and when you're sure it's safe run it
chmod +x /tmp/nodesource_setup.sh
/tmp/nodesource_setup.sh
apt install nodejs -y
node --version
> v18.15.0
npm --version
> 9.5.0
```

Depoyu klonlama ve yükleme

```bash
git clone https://github.com/eco-stake/restake
cd restake
npm install && npm run build
cp .env.sample .env
```
**Yeni .env dosyanıza anımsatıcı kelimelerinizi yazın.**

#### Yerel versiyonunuzu güncelleme

REStake MVP'dir. Çok MVP. Güncellemeler her zaman oluyor ve hala düzeltilmesi gereken hatalar var. Sık sık güncelleme yaptığınızdan emin olun.

Yerel deponuzu güncelleyin ve aşağıdaki komutlarla Docker konteynırlarınızı önceden oluşturun:

```bash
git pull
docker-compose run --rm app npm install
docker-compose build --no-cache
```

NPM için kodlar:

```bash
git pull
npm install
```

Komut dosyasını çalıştırma

Oto-stake komut dosyasını manuel olarak çalıştırmak basittir.

Docker kullanıyorsanız, aşağıdaki komutları `docker-compose run ---rm app` ile kullanmalısınız.

Not: Docker kurulumunuzda root yetkisine sahip değilseniz `sudo` kullanmanız gerekebilir ve bazı docker sürümleri `docker-compose` yerine `docker compose`'u kullanır. Sorunlarla karşılaşırsanız, `docker compose' kullanmayı deneyin.

```bash
docker-compose run --rm app npm run autostake
```

Alternatif olarak, eğer NPM kullanıyorsanız, `docker-compose run --rm app` önekini göz ardı edebilirsiniz ve aağıdaki kodu kullanmanız yeterli olacaktır.

```bash
npm run autostake
```

Komut dosyasını belirli ağlarla sınırlamak için ağ adlarını yazabilirsiniz.

```bash
npm run autostake osmosis akash regen
```

Normal oto-stake komut dosyasını çalıştıran ancak gönderilen son TX'leri ve herhangi bir sağlık durumu kontrolü için pingleri atlayan bir Dry Run komut dosyası da kullanılabilir.

```bash
npm run dryrun osmosis
```

**REStake operatör bilgilerinizi [Operatörünüzü kaydetme](#operat%C3%B6r%C3%BCn%C3%BCz%C3%BC-kaydetme) bölümünde gösterileceği gibi [Validator Kayıt Defteri](https://github.com/eco-stake/validator-registry)'ne kaydınızı yapana kadar 'operatör olmadığınıza dair bir uyarı görebilirsiniz.**


### REStake'i özelleştirin ve node'unuzu kullanın

Muhtemelen ağların yapılandırılmasını özelleştirmek isteyeceksiniz, örneğin auto compounding (ödüllerinizi otomatik olarak yeniden stake etmek) komut dosyanızın başarılı bir şekilde tamamlanmasını sağlamak için node'unuzun URL'lerinizi ayarlamak gibi.

Bir `src/networks.local.json` dosyası oluşturun ve geçersiz kılmak istediğiniz ağları belirtin. Aşağıdaki sadece bir örnektir, **ihtiyaç gerekirse sadece bir yapılandırmayı geçersiz kılmalısınız.**

```json
{
  "osmosis": {
    "prettyName": "Osmosis",
    "restUrl": [
      "https://rest.cosmos.directory/osmosis"
    ],
    "gasPrice": "0.0025uosmo",
    "autostake": {
      "retries": 3,
      "batchPageSize": 100,
      "batchQueries": 25,
      "batchTxs": 50,
      "delegationsTimeout": 20000,
      "queryTimeout": 5000,
      "queryThrottle": 100,
      "gasModifier": 1.1
    },
    "healthCheck": {
      "uuid": "XXXXX-XXX-XXXX"
    }
  },
  "desmos": {
    "prettyName": "Desmos 118",
    "autostake": {
      "correctSlip44": true
    }
  },
  "cosmoshub": {
    "enabled": false
  }
}
```

Belirttiğiniz değerler `networks.json` dosyasını geçersiz kılacaktır. Bunlar örneklerdir, ihtiyacınız göre ayarlayabilirsiniz.

Diziler değiştirilecek ve birleştirilmeyecektir. Dosya `.gitignore`'idir, böylece yukarı akış güncellemelerini etkilemez.

REStake'in, indeksleme etkin ve `networks.json` gas fiyatı ile eşleşen minimum gas fiyatlarına sahip bir düğüm gerektirdiğini unutmayın.

### Komut dosyasını bir program dahilinde çalıştırmak için cron/zamanlayıcıları ayarlamak

Komut dosyasını her gün aynı saatte çalıştıracak şekilde ayarlamalısınız. 2 yöntem aşağıda açıklanmıştır;  `crontab` ya da `systemd-timer` kullanma.

Her iki durumda da, sistem zamanınızın doğru olduğundan emin olun ve komut dosyasının UTC'de ne zaman çalışacağını biliyor olmalısınız, çünkü bu daha sonra gerekli olacak. Her iki örnek de saat 21:00'e göre verilmiştir.

[Sık sık güncellemeyi](#yerel-versiyonunuzu-g%C3%BCncelleme) unutmayın!

#### `crontab` Kullanma

NOT: REStake zamanlayıcınızı `crontab`'a göre belirlemek için faydalı bir hesap makinesini buradan ulaşabilirsiniz: https://crontab.guru/.

Güncellenmiş sürümler, `docker-compose` yerine `docker compose` kullanır. Sorunlarla karşılaşırsanız, `docker compose` yerine bunu kullanmayı deneyin.

```bash
crontab -e
0 21 * * * /bin/bash -c "cd restake && docker compose run --rm app npm run autostake" > ./restake.log 2>&1
```

ya da NPM için bunu kullanabilirsiniz:

```bash
crontab -e
0 21 * * * /bin/bash -c "cd restake && npm run autostake" > ./restake.log 2>&1
```

#### `systemd-timer` Kullanma

Systemd-timer, belirtilen kurallarla bir kerelik hizmetin çalıştırılmasına izin verir. Bu yöntem tartışmasız Cron'a tercih edilir.

##### systemd birimi dosyası oluşturma

Birim dosyası çalıştırılacak uygulamayı tanımlar. `Wants` ve zamanlayıcı ifadesi ile bir bağımlılık tanımlıyoruz.

```bash
sudo vim /etc/systemd/system/restake.service
```

```bash
[Unit]
Description=restake service with docker compose
Requires=docker.service
After=docker.service
Wants=restake.timer
[Service]
Type=oneshot
WorkingDirectory=/path/to/restake
ExecStart=/usr/bin/docker-compose run --rm app npm run autostake
[Install]
WantedBy=multi-user.target
```
NPM kurulumu için `Requires` ve `After` direktiflerini kaldırın ve` `ExecStart`'ı` `ExecStart=/usr/bin/npm run autostake` olarak değiştirin.

🔴 **Not: Sorun yaşarsanız `WorkingDirectory=/path/to/restake` bölümünü `WorkingDirectory=/root/restake` olarak değiştiriniz. Eğer yine sorun yaşarsanız `chmod 777 /root/restake` komutu ile dosyaya okuma, yazma ve çalıştırma izni veriniz. Daha sonra `systemctl daemon-reload` yaptıktan sonra sistemi yeniden başlatınız. **

🔴 **Eğer `Failed to restake service with docker compose` gibi bir hata alırsanız yine `chmod 777 /usr/bin/docker-compose` komutu ile dosyaya okuma, yazma ve çalıştırma izni veriniz.**

Çözüm için değerli arkadaşım [Odyseus](https://github.com/odyseus8)'a teşekkür ederim.

##### systemd timer dosyası oluşturma

Zamanlayıcı dosyası, yeniden düzenleme hizmetini her gün çalıştırma kurallarını tanımlar. Tüm kurallar [systemd dokümanlarında] (https://www.freedesktop.org/software/systemd/man/systemd.timer.html) açıklanmaktadır.

Not: `OnCalendar` için restake sürelerini belirlemek için yararlı hesap makinesi https://crontab.guru/ adresinde bulunabilir.

```bash
sudo vim /etc/systemd/system/restake.timer
```

```bash
[Unit]
Description=Restake bot timer
[Timer]
AccuracySec=1min
OnCalendar=*-*-* 21:00:00
[Install]
WantedBy=timers.target
```

##### Servisleri Etkinleştirme ve Başlatma

```bash
systemctl enable restake.service
systemctl enable restake.timer
systemctl start restake.timer
```

##### Zamanlayıcınızı kontrol etme

`systemctl status restake.timer`
<pre><font color="#8AE234"><b>●</b></font> restake.timer - Restake bot timer
     Loaded: loaded (/etc/systemd/system/restake.timer; enabled; vendor preset: enabled)
     Active: <font color="#8AE234"><b>active (waiting)</b></font> since Sun 2022-03-06 22:29:48 UTC; 2 days ago
    Trigger: Wed 2022-03-09 21:00:00 UTC; 7h left
   Triggers: ● restake.service
</pre>

`systemctl status restake.service`
<pre>● restake.service - stakebot service with docker compose
     Loaded: loaded (/etc/systemd/system/restake.service; enabled; vendor preset: enabled)
     Active: inactive (dead) since Tue 2022-03-08 21:00:22 UTC; 16h ago
TriggeredBy: <font color="#8AE234"><b>●</b></font> restake.timer
    Process: 86925 ExecStart=/usr/bin/docker-compose run --rm app npm run autostake (code=exited, status=0/SUCCESS)
   Main PID: 86925 (code=exited, status=0/SUCCESS)
</pre>

### İzleme

Her ağ için komut dosyası durumunu bildirmek için REStake oto-stake betiği [healthchecks.io] (https://healthchecks.io/) ile entegre olabilir. [HealthChecks.io] (https://healthchecks.io/) daha sonra, herhangi bir arızayı bildiğinizden emin olmak için e -posta, Discord ve Slack gibi birçok bildirim platformuyla entegre edilebilir.

Yapılandırıldıktan sonra, komut dosyası başladığında, başarılı ya da başarısız olduğunda REStake [healthchecks.io](https://healthchecks.io/)'a ping atacaktır. Kontrol günlüğü ilgili hata bilgilerini içerecektir ve yapılandırılması basittir.

Komut dosyasını çalıştırdığınız her ağ için bir kontrol ayarlayın ve beklenen programı yapılandırın. Örneğin, her 12 saatte bir Osmosis kontrolü ekleyin, Akash için her 1 saatte bir vb.

Kontrol UUID numaranızı aşağıdaki gibi `networks.local.json` yapılandırma dosyanızda ilgili ağa ekleyin. İsteğe bağlı olarak [HealthChecks.io platformunu kendi hostinginizde barındırmak](https://healthchecks.io/docs/self_hosted/) istiyorsanız. `address` özniteliğini de ayarlayabilirsiniz.

```JSON
{
  "osmosis": {
    "healthCheck": {
      "uuid": "77f02efd-c521-46cb-70g8-fa5v275au873"
    }
  }
}
```

### Operatörünüzü kaydetme

#### REStake Operatörünüzü Kurma

Artık operatör bilgilerinizi oto-sake'i aktif etmek istediğiniz ağları eklemek için [Validator Kayıt Defteri](https://github.com/eco-stake/validator-registry)'ni güncellemeniz gerekiyor. Örnekler için README ve mevcut doğrulayıcıları kontrol edebilirsiniz, ancak bir ağ için yapılandırma şuna benziyor:


```json
{
  "name": "akash",
  "address": "akashvaloper1xgnd8aach3vawsl38snpydkng2nv8a4kqgs8hf",
  "restake": {
    "address": "akash1yxsmtnxdt6gxnaqrg0j0nudg7et2gqczud2r2v",
    "run_time": [
      "09:00",
      "21:00"
    ],
    "minimum_reward": 1000
  }
},
```

`address` doğrulayıcınızın adresidir ve `restake.address` ise fee ödemeleri için oluşturduğunuz yeni sıcak cüzdanınızın adresidir.

`restake.run_time` *UTC zaman diliminde* botunuzu çalıştırmayı düşündüğünüz zamandır ve orada birkaç seçenek vardır. Belli bir saat ayarlamak için, ör. `09:00`, UTC zaman diliminde 9am (sabah dokuzda) scripti çalıştırdığınızı belirtir. Birden fazla zaman için bir dizi de kullanabilirsiniz, örneğin `["09:00", "21:00"]`. Saatte/günde birden çok kez için bir aralık dizesi kullanabilirsiniz, örneğin, `"every 15 minutes"`.

`restake.minimum_reward`, otomatik stake'i tetiklemek için asgari ödüldür, aksi takdirde adres atlanır. Bu, daha sık yeniden düzenleme için daha yüksek ayarlanabilir. Bunun temel nominal değer olduğunu unutmayın, Örneğin, `uosmo`.

REStake yapmak istediğiniz tüm ağlar için bu yapılandırmayı tekrarlayın.

`restake.address`'in kullanıcı ara yüzünde delegator'ün restake işlemlerini gerçekleştirmek için vermiş olduğu adrese stake işleminde fee ücretinin alınacağı adres olduğunu unutmayın.

#### Operatörünüzü Validator Kayıt Defterine kaydetme

Artık [Validator Kayıt Defteri] (https://github.com/eco-stake/validator-registry) güncellemenizi mümkün olan en kısa sürede merge edilmek üzere pull request isteğinde bulunabilirsiniz. REStake, değişikliklerin birleştirilmesinden sonraki 15 dakika içinde otomatik olarak güncellenir.

## Katkıda Bulunma

### Bir Ağ Ekleme/Güncelleme

Ağ bilgileri [Zincir Kayıt Defteri] (https://github.com/cosmos/chain-registry) [registry.cosmos.directory] (https://registry.cosmos.directory) API üzerinden alınır. Yeterli temel bilgilerin sağlandığı varsayılarak, REStake'e ana daldaki zincirler otomatik olarak eklenir.

'networks.json' dosyası, REStake'de 'desteklendiği' gibi hangi zincirlerin göründüğünü tanımlar; zincir adı Zincir Kayıt Defterinden dizin adıyla eşleştiği sürece, tüm zincir bilgileri otomatik olarak sağlanacaktır. Alternatif olarak zincirler, tek başına `networks.json`'da _desteklenebilir_, ancak bu belgelenmiş bir özellik değildir.

Bir zinciri yeniden eklemek veya geçersiz kılmak için gerekli bilgileri aşağıdaki gibi `networks.json`'a ekleyin:

```json
{
  "name": "osmosis",
  "prettyName": "Osmosis",
  "gasPrice": "0.025uosmo",
  "authzSupport": true
}
```

`networks.json`'daki CamelCase sürümünü tanımlayarak zincir kayıt defterinin çoğunun geçersiz kılınabileceğini unutmayın.

### Kullanıcı Arayüzünü (UI) Çalıştırma

Docker'ı kullanarak kullanıcı arayüzünü bir satırla çalıştırın:

```bash
docker run -p 80:80 -t ghcr.io/eco-stake/restake
```

`docker-compose up` ya da `npm start` kullanarak kaynaktan alternatif olarak da çalıştırılabilir.

## Etik

REStake kullanıcı arayüzü hem validator hem de ağ için agnostiktir. Herhangi bir delegator bir operatör olarak eklenebilir ve delegatorlerine otomatik birleştirme hizmeti sağlamak için bu aracı çalıştırabilir ancak markayı kendilerine uyacak şekilde seçip ayarlarlarsa kendi kullanıcı arayüzlerini de çalıştırabilirler.

Bunun çalışması için ortak bir zincir bilgisi kaynağına ve ortak bir 'operator' bilgisi kaynağına ihtiyacımız var. Zincir bilgileri, [Cosmos.Directory](https://github.com/eco-stake/cosmos-directory) tarafından sağlanan bir API aracılığıyla [Zincir Kayıt Defteri](https://github.com/cosmos/chain-registry)'nden temin edilir. Operatör bilgileri [Validator Kayıt Defteri](https://github.com/eco-stake/validator-registry)'nde bulunur.

Artık ortak bir operatör bilgisi kaynağımız var, uygulamalar verileri doğrudan GitHub'dan ya da [cosmos.directory](https://github.com/eco-stake/cosmos-directory) projesi aracılığıyla yeniden kullanabilir.

## Feragatname

REStake ilk sürümü yeni authz özelliklerinden yararlanmak için hızlı bir şekilde oluşturuldu. Ben şahsen bir React veya JavaScript geliştiricisi değilim ve bu proje [CosmJS projesi](https://github.com/cosmos/cosmjs) ve [Keplr Wallet](https://github.com/chainapsis/keplr-wallet) ve [Osmosis Zone frontend](https://github.com/osmosis-labs/osmosis-frontend) gibi diğer fantastik kod tabanlarına son derece eğiliyor.

## ECO Stake 🌱

ECO Stake iklim pozitif bir validatordur, ancak Cosmos ekosistemini de önemsiyoruz. Tüm validatorlerin Authz ile bir otomatik stake çalıştırmasını kolaylaştırmak için REStake'i inşa ettik ve ekosistemde üzerinde çalıştığımız birçok projeden biridir.

Bunun gibi daha fazla projeyi desteklemek için bizimle delege edin [bizimle delege edin](https://ecostake.com).
