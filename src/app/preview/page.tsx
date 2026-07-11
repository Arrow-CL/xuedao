"use client";
import MathContent from "@/components/MathContent";
import { ArrowLeft, ChevronDown } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

type QuestionItem = {
  num: number;
  type: string;
  prompt: string;
  options?: string[];
  image?: string; // public 下的图片路径
};

type Paper = {
  id: string;
  name: string;
  questions: QuestionItem[];
};

const PAPERS: Paper[] = [
  {
    id: "xinkebiao1",
    name: "2026 新课标一卷",
    questions: [
      { num: 1, type: "单选", prompt: "样本数据$6,8,4,5,12$的中位数为", options: ["$5$", "$6$", "$8$", "$9$"] },
      { num: 2, type: "单选", prompt: "已知平面向量$\\boldsymbol{a},\\boldsymbol{b}$不共线，且$2\\boldsymbol{a}+y\\boldsymbol{b}=x\\boldsymbol{a}-3\\boldsymbol{b}$，则", options: ["$x=2,y=-3$", "$x=-2,y=3$", "$x=2,y=3$", "$x=-2,y=-3$"] },
      { num: 3, type: "单选", prompt: "已知集合$A=\\left\\{\\sin\\dfrac{7\\pi}{6},\\cos\\dfrac{5\\pi}{3},\\tan\\dfrac{5\\pi}{4}\\right\\}$，$B=\\left\\{-\\dfrac{\\sqrt{3}}{2},-\\dfrac{1}{2},1\\right\\}$，则$A\\cap B=$", options: ["$\\left\\{-\\dfrac{\\sqrt{3}}{2},-\\dfrac{1}{2}\\right\\}$", "$\\left\\{-\\dfrac{\\sqrt{3}}{2},1\\right\\}$", "$\\left\\{-\\dfrac{1}{2},1\\right\\}$", "$\\left\\{-\\dfrac{\\sqrt{3}}{2},-\\dfrac{1}{2},1\\right\\}$"] },
      { num: 4, type: "单选", prompt: "曲线$y=5x+8\\ln x$在点$(1,5)$的切线方程为", options: ["$y=3x+2$", "$y=5x$", "$y=8x-3$", "$y=13x-8$"] },
      { num: 5, type: "单选", prompt: "已知抛物线$C_1:y^2=2p_1x(p_1>0)$和$C_2:x^2=2p_2y(p_2>0)$均经过点$(4,8)$，则$C_1$的焦点与$C_2$的焦点之间的距离为", options: ["$12$", "$4\\sqrt{5}$", "$6$", "$\\dfrac{\\sqrt{65}}{2}$"] },
      { num: 6, type: "单选", prompt: "已知函数$f(x)=\\dfrac{x+2}{e^x+a}$的最大值为$1$，则$a=$", options: ["$\\dfrac{1}{2}$", "$1$", "$\\dfrac{3}{2}$", "$2$"] },
      { num: 7, type: "单选", prompt: "一百零八塔位于宁夏回族自治区青铜峡市，以其独特的建筑格局和深远的历史文化闻名遐迩，该塔群共有108座塔，依山势自上而下排成12行，将第$i$行中塔的座数记为$a_i\\ (i=1,2,\\dots,12)$，其中$a_1=1$，$a_3=a_4=3$，$a_6=a_7=5$，且$a_1,a_2,\\dots,a_{12}$是一个首项为7，公差为2的等差数列，将$a_1,a_2,\\dots,a_{12}$分为6组，每组2个数，使得每组的2个数之和可构成一个项数为6且公差为$d(d>0)$的等差数列，则$d=$", options: ["$2$", "$4$", "$6$", "$8$"] },
      { num: 8, type: "单选", prompt: "设$U=\\{(x_1,x_2,x_3)\\mid x_i\\in\\{-2,-1,1,2\\},i=1,2,3\\}$为空间中64个点构成的集合，记$P(1,1,1)$，记样本空间$\\Omega=\\complement_UP$，从$\\Omega$中随机取一个点，定义随机变量$X$如下：对$\\Omega$中的每个点$A(x_1,x_2,x_3)$，令$X(A)=x_1+x_2+x_3$，则$X$的数学期望为", options: ["$-\\dfrac{1}{21}$", "$-\\dfrac{1}{63}$", "$0$", "$\\dfrac{1}{7}$"] },
      { num: 9, type: "多选", prompt: "设$z=3+2\\mathrm{i}$，则", options: ["$\\overline{z}=3-2\\mathrm{i}$", "$|z|=5$", "$z^2=5+12\\mathrm{i}$", "$\\dfrac{z+3}{\\mathrm{i}-1}\\in\\mathbb{R}$"] },
      { num: 10, type: "多选", prompt: "在空间中，$A、B$为两个定点，动点$C$到直线$AB$的距离为2，动点$D$到直线$AB$的距离为1，若二面角$C-AB-D$为$60^\\circ$，则", options: ["$\\angle CAD\\ge60^\\circ$", "$CD\\ge\\sqrt{3}$", "当$AB\\perp CD$时，$CD\\perp$平面$ABD$", "当$AB\\perp$平面$ACD$时，$AC\\perp AD$"] },
      { num: 11, type: "多选", prompt: "已知圆$C_1:(x+1)^2+y^2=1$，圆$C_2:(x-1)^2+y^2=1$，圆$C_3:x^2+(y-\\sqrt{3})^2=1$，直线$l:y=kx+b$与$C_1,C_2,C_3$均有两个交点，记$l$被$C_1,C_2,C_3$截得的弦长分别为$s_1,s_2,s_3$，则", options: ["$k$可以取任意实数", "满足$s_1=s_2=s_3$的直线$l$共有3条", "满足$s_1+s_2+s_3=1$的直线$l$多于3条", "当$b=0$时，$s_1+s_2+s_3$的最大值为$\\dfrac{2\\sqrt{21}}{3}$"] },
      { num: 12, type: "填空", prompt: "双曲线$5x^2-6y^2=1$的离心率为________." },
      { num: 13, type: "填空", prompt: "已知$f(x)=2\\sin(ax+\\theta)(a\\in\\mathbb{Z},0\\le\\theta<2\\pi)$是偶函数，$f(x)$在区间$\\left(0,\\dfrac{\\pi}{2}\\right)$单调递增，则$\\theta=$________." },
      { num: 14, type: "填空", prompt: "设实数$q$满足：存在数列$\\{a_n\\}$，使得对于任意$n\\in\\mathbb{N}^*$，均有$a_1+a_2+\\dots+a_{3n}=n^2+n$，且$\\{a_n\\}$中有某连续9项$a_k,a_{k+1},\\dots,a_{k+8}$是公比为$q$的等比数列，则$q$的最大值为________." },
      { num: 15, type: "解答", prompt: "如图，在直三棱柱$ABC-A_1B_1C_1$中，$\\angle ACB=90^\\circ$，$AC=BC$，$D,E$分别为$AB,A_1C_1$的中点。\n(1) 证明：$DE\\parallel$平面$BCC_1B_1$；\n(2) 设$CC_1=2$，直线$DE$与平面$ACC_1A_1$所成的角为$45^\\circ$，求直线$DE$到平面$BCC_1B_1$的距离。", image: "/q15-xinkebiao1.png" },
      { num: 16, type: "解答", prompt: "已知在$\\triangle ABC$中，$AB=3$，$BC=2\\sqrt{3}$，$\\cos B=\\dfrac{\\sqrt{3}}{3}$.\n(1) 求$\\cos A$；\n(2) 设$D,E$两点满足：$D$在$BA$的延长线上，$DE\\parallel BC$，$AE\\perp AC$.若$DE=\\sqrt{6}$，求$CE$." },
      { num: 17, type: "解答", prompt: "设整数$N\\ge2$.某同学用一个球进行投篮练习，至多设置$N$次。当且仅当投中1次时或$N$次均未投中时，停止练习。设该同学每次投中的概率为$p(0<p<1)$，各次投中与否相互独立.记$X$为停止练习时该同学的投篮次数.\n(1) 当$N=4$，$p=\\dfrac{1}{3}$时，求$X$的分布列；\n(2) 设$k,m$均为自然数.\n(i) 当$k\\le N-1$时，求$P(X>k)$；\n(ii) 当$k+m\\le N-1$时，证明：$P(X>k+m\\mid X>k)=P(X>m)$." },
      { num: 18, type: "解答", prompt: "已知椭圆$C:\\dfrac{x^2}{a^2}+\\dfrac{y^2}{b^2}=1(a>b>0)$的左焦点为$F(-1,0)$，离心率为$\\dfrac{1}{2}$.\n(1) 求$C$的方程；\n(2) 设$O$为坐标原点，过$F$且斜率大于0的动直线$l$与$C$交于$P,Q$两点，其中$Q$在第三象限，直线$PO$与$C$的另一个交点为$R$.\n(i) 若$\\triangle PQR$的面积是$\\triangle PFO$的面积的3倍，求$l$的方程；\n(ii) 求$\\tan\\angle PQR$的最小值." },
      { num: 19, type: "解答", prompt: "已知函数$f(x)$的定义域为$\\mathbb{R}$，且当$x<0$时，$f(x)=2^x$.对任意$x_0\\in\\mathbb{R}$，定义集合$D(x_0)=\\{d\\in\\mathbb{R}\\mid f(x_0+d)>f(x_0)\\}$.\n(1) 若当$x\\ge0$时，$f(x)=1-x$，求$D(-1)$；\n(2) 若$f(x)$是奇函数，$f(x_1)\\le f(x_2)$，且$x_1x_2\\neq0$，证明：$D(x_2)\\subseteq D(x_1)$；\n(3) 设$f(x)$满足：①若$f(x_1)\\le f(x_2)$，则$D(x_2)\\subseteq D(x_1)$；②当$0<x<1$时，$f(x)<f(0)$.\n(i) 证明：$f(0)\\ge1$；\n(ii) 证明：$f(x)$在区间$(0,+\\infty)$单调递增." },
    ],
  },
  {
    id: "xingaokao2",
    name: "2026 新高考二卷",
    questions: [
      { num: 1, type: "单选", prompt: "$(1-3\\mathrm{i})^2=$", options: ["$-8+6\\mathrm{i}$", "$-8-6\\mathrm{i}$", "$8+6\\mathrm{i}$", "$8-6\\mathrm{i}$"] },
      { num: 2, type: "单选", prompt: "已知向量$\\boldsymbol{a},\\boldsymbol{b}$满足$|\\boldsymbol{a}+\\boldsymbol{b}|=1$，$|\\boldsymbol{a}-\\boldsymbol{b}|=\\sqrt{3}$，则$\\boldsymbol{a}\\cdot\\boldsymbol{b}=$", options: ["$\\dfrac12$", "$\\dfrac14$", "$-\\dfrac12$", "$-\\dfrac14$"] },
      { num: 3, type: "单选", prompt: "已知集合$A=\\{0,1,3,6,9\\}$，$B=\\{x\\mid\\sqrt{x}=x\\}$，则$A\\cap B=$", options: ["$\\{0,1\\}$", "$\\{3,6\\}$", "$\\{0,1,9\\}$", "$\\{0,3,9\\}$"] },
      { num: 4, type: "单选", prompt: "双曲线$C:\\dfrac{x^2}{a^2}-\\dfrac{y^2}{b^2}=1(a>0,b>0)$过点$(1,0)$和$\\left(\\dfrac{\\sqrt{5}}{2},3\\right)$，则其渐近线方程为", options: ["$y=\\pm3\\sqrt{2}x$", "$y=\\pm4\\sqrt{3}x$", "$y=\\pm\\dfrac{\\sqrt{3}}{2}x$", "$y=\\pm\\dfrac{\\sqrt{6}}{6}x$"] },
      { num: 5, type: "单选", prompt: "棱台上下底面均为有一个内角是$60^\\circ$的菱形，上下底面边长分别为$2$和$3$，该棱台的高为$\\sqrt{3}$，则该棱台体积为", options: ["$\\dfrac{19}{12}$", "$\\dfrac{19}{6}$", "$\\dfrac{19}{4}$", "$\\dfrac{19}{2}$"] },
      { num: 6, type: "单选", prompt: "甲、乙、丙、丁等8人分成$A,B$两个技术小组，要求每组4人，且甲乙必须在同一组，丙丁不能在同一组，共有多少分配方案", options: ["$10$", "$12$", "$16$", "$24$"] },
      { num: 7, type: "单选", prompt: "已知$\\alpha$为第二象限角，且$3\\sin2\\alpha\\cos\\alpha=8\\sin\\alpha\\cos2\\alpha$，则$\\dfrac{1+\\sin\\alpha}{2-\\cos\\alpha}=$", options: ["$\\dfrac34$", "$\\dfrac32$", "$\\dfrac12$", "$\\dfrac{15}{8}$"] },
      { num: 8, type: "单选", prompt: "已知$f(x)$为定义在$\\mathbb{R}$上的偶函数，且$f(x)+f(x-2)=0$，当$x\\in\\left[\\dfrac32,3\\right]$时，$f(x)=x^2+ax+b$，则", options: ["$a=-2,b=-3$", "$a=-2,b=3$", "$a=-4,b=-3$", "$a=-4,b=3$"] },
      { num: 9, type: "多选", prompt: "已知$\\odot O:x^2+y^2=1$，$\\odot A:x^2+y^2-6x-8y+k=0$，则", options: ["点$A$的坐标为$(-3,-4)$", "$k=9$时，$\\odot A$与$x$轴相切", "当$k=-11$时，$\\odot A$与$\\odot O$相切", "当$\\odot O$与$\\odot A$相交时，两交点所在直线的方程是$6x+8y-k-2=0$"] },
      { num: 10, type: "多选", prompt: "等比数列$\\{a_n\\}$的公比$q\\neq1$，$a_1>0$，$2a_3=a_2+a_1$，记前$n$项和为$S_n$，则", options: ["$q=-\\dfrac12$", "$S_n>\\dfrac{2a_1}{3}$", "$2S_{n+2}=S_{n+1}+S_n$", "$\\sum\\limits_{k=1}^n S_k>\\dfrac{2na_1}{3}$"] },
      { num: 11, type: "多选", prompt: "已知抛物线$E:y^2=8x$，斜率$k(k>0)$的直线$l$过点$(1,0)$，$\\triangle ABC$为等边三角形，$A$在$y$轴上，$B,C$在$l$上，则", options: ["抛物线准线方程为$x=-2$", "$l$与$y$轴交点为$(0,-k)$", "若$l$与$E$相交于唯一一点$B$，则抛物线焦点在直线$AB$上", "$k=2$时，$\\triangle ABC$面积最小值为$\\dfrac{\\sqrt{3}}{2}$"] },
      { num: 12, type: "填空", prompt: "$S_n$为等差数列$\\{a_n\\}$前$n$项和.若$a_1=-1$，$a_4=5$，则$S_6=$________." },
      { num: 13, type: "填空", prompt: "若函数$f(x)=2^x+2^{-x}-m$有两个零点，则$m$的取值范围是________." },
      { num: 14, type: "填空", prompt: "球$O$的体积为$4\\sqrt{3}\\pi$，$A,B,C,D$四点均在球$O$的球面上，$\\triangle ABC$为等边三角形，$DA=DB=DC=\\sqrt{2}$，则$\\triangle ABC$的面积为________." },
      { num: 15, type: "解答", prompt: "某工厂抽取一批电子元件检测，记录第一次出现故障的时间(天)，绘制成如下的频率分布直方图：\n横轴区间：$[345,355),[355,365),[365,375),[375,385),[385,395),[395,405),[405,415),[415,425]$，组距均为10；\n纵轴（频率/组距）对应高度依次：$0.01$、$0.02$、$0.015$、$0.025$、$0.01$、$0.01$、$0.005$、$0.005$。\n(1) 求第一四分位数和中位数；\n(2) $\\hat{p}$为首次故障时间小于365天的概率估计值.\n(i) 求$\\hat{p}$；\n(ii) 工厂向某用户销售100件电子元件，$X$为这100件产品首次出现故障小于365天的件数，则$X\\sim B(100,\\hat{p})$，求$E(X),D(X)$.", image: "/q15-xingaokao2.png" },
      { num: 16, type: "解答", prompt: "三棱锥$A-BCD$中，$E$在$BD$上，$AE\\perp CE$，$AE\\perp DE$，$CD\\perp AD$.\n图形文字描述：四面体$A-BCD$，底面$\\triangle BCD$，$BD$边上中点附近点$E$，连接$AE、CE$；顶点$A$在底面上方，虚线$AE$垂直底面线段$DE、CE$。\n(1) 证明：$CD\\perp AB$；\n(2) 若$DE=2$，$BE=1$，$AE=\\sqrt{2}$，$CD=2\\sqrt{3}$，求$AD$与平面$ABC$所成角的正弦值.", image: "/q16-xingaokao2.png" },
      { num: 17, type: "解答", prompt: "在$\\triangle ABC$中，已知$\\cos B=\\dfrac34$，$\\cos^2(A+C)+\\sin A\\sin C=1$.\n(1) 证明：$\\triangle ABC$为钝角三角形；\n(2) 若$\\triangle ABC$面积为$\\dfrac{\\sqrt{7}}{4}$，求$\\triangle ABC$周长." },
      { num: 18, type: "解答", prompt: "椭圆$E:\\dfrac{x^2}{a^2}+y^2=1(a>1)$，过右焦点垂直于$x$轴的直线被$E$所截线段长为$\\sqrt{2}$.\n(1) 求$E$的离心率；\n(2) $O$为坐标原点，给定点$G(t_0,0)(t_0\\neq0)$；$A(x_0,y_0)(y_0\\neq0)$在$E$上，过点$A$作$y$轴的垂线，交于点$B$，$AO$与$GB$交于点$P$。当$A$在$E$上运动时，$P$的轨迹为$M$.\n(i) 求$M$的方程；\n(ii) $M$是否有中心点？当$t_0$为何值时，$M$有中心点？当$M$有中心点时，平移$M$到$M'$，使$O$为$M'$的中心点，说明$M'$为何形状？" },
      { num: 19, type: "解答", prompt: "已知函数$f(x)=xe^x+ax+b$，曲线$y=f(x)$在点$(0,f(0))$处的切线方程为$y=-2x+1$.\n(1) 求$a,b$；\n(2) 当$x>0$时，$f(x+m)-f(x)>m$，求$m$的取值范围；\n(3) 当$x>0$时，$f(x+k)+f(k-x)>2f(k)$，求$k$的最小值." },
    ],
  },
];

export default function PreviewPage() {
  const [activePaper, setActivePaper] = useState(0);
  const paper = PAPERS[activePaper];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-gray-600">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-gray-900">高考真题识别预览</h1>
              <p className="text-xs text-gray-400">检查题目文本和图片识别是否正确</p>
            </div>
          </div>

          {/* Paper selector */}
          <div className="flex gap-2 mt-3">
            {PAPERS.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setActivePaper(i)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  activePaper === i
                    ? "bg-indigo-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {paper.questions.map((q) => (
          <div key={q.num} className="bg-white rounded-xl border border-gray-100 p-5">
            {/* Question header */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                第{q.num}题
              </span>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                {q.type}
              </span>
            </div>

            {/* Question text */}
            <div className="text-sm text-gray-800 leading-relaxed">
              <MathContent text={q.prompt} />
            </div>

            {/* Options */}
            {q.options && (
              <div className="mt-3 space-y-1.5">
                {q.options.map((opt, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-1.5"
                  >
                    <span className="font-medium text-gray-500 shrink-0">
                      {String.fromCharCode(65 + i)}.
                    </span>
                    <MathContent text={opt} />
                  </div>
                ))}
              </div>
            )}

            {/* Image */}
            {q.image && (
              <div className="mt-4">
                <div className="text-xs text-gray-400 mb-2">第{q.num}题图形：</div>
                <div className="rounded-lg border border-gray-200 overflow-hidden bg-white inline-block">
                  <Image
                    src={q.image}
                    alt={`第${q.num}题图形`}
                    width={500}
                    height={350}
                    className="w-full max-w-lg"
                    unoptimized
                  />
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Bottom note */}
        <div className="text-center text-xs text-gray-400 py-4">
          {paper.name} · 共 {paper.questions.length} 道题
        </div>
      </div>
    </div>
  );
}
