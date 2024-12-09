第一作者（共一）：Yuanqi Li,   Arthi Padmanabhan

学校：加利福尼亚大学洛杉矶分校（University of California, Los Angeles）

## 摘要

提出了Reducto，一个在摄像头端进行数据过滤并且可以根据各种特征进行动态自适应调整的决策系统（任务仅限识别，计数，检测）

## 背景介绍

#### 简单概括

由于相机性能抛弃压缩检测模型方法，由于速度和过滤方式抛弃二元分类模型并旨在帧差分方法上特征间的关系寻找动态阈值来实现更好的效果。

#### 现状分析与常用方法对比

摄像头在城市中的覆盖范围逐年增大，神经网络方法逐年发展，导致越来越多的视频源需要进行各种各样的处理。**摄像机拍摄到视频后会传输到云服务器（或先传输到边缘设备），云服务器立刻运行检测模型来完成用户相关的视频查询**。实时视频分析Pipeline中由于**需要大量的网络和计算资源**，需要在系统中有针对视频的**过滤机制**，目前系统采用的过滤方法常见的有：

1. [时间冗余消除] 使用**更小的压缩检测模型**（比如Tiny YOLO，Focus）先生成置信度，再根据置信度来判断帧要不要发送到完整模型。其运行速度最慢，甚至难以达到实时输出。
2. [时间冗余消除] 专门的**二元分类模型**（比如 FilterForward NoScope），对每个帧进行判断看是或不是包含兴趣对象的帧，不是就抛弃。其运行速度中等，在合适的配置下可以实现实时输出。
3. [时间冗余消除] 简单**帧差分方法**（比如Glimpse），通过比较视频的低级像素特征上的变化来进行时间维度冗余帧的消除。其运行速度较快，计算较为简单，基本在各种配置下都可轻松实现实时输出。

大部分的过滤会放到云边端模型上的边缘侧或者云侧来进行过滤，作者希望将过滤的操作放到相机端，这样**尽早过滤数据可以减轻后续的计算负担和网络负担**。但由于商用相机的计算资源很有限，即便是之前提到的压缩后的神经网络也在摄像头端排除在外（CPU1GHz和RAM 256MB使得Tiny YOLO的运行速度＜1FPS），而二元分类NN常常保留过多冗余，帧差分常常过滤太多帧导致准确性下降。

#### 为什么要拓展帧差分方法

和离线最优策略（离线计算所有帧并且进行最优过滤）相比，**二元分类会多放70%+的数据**（比如现在任务是对车辆计数，场景基本静态，这里由于每帧都有兴趣对象所以二元分类会放很多帧，而实际上极多帧间的车辆数量都没有发生任何变化，存在巨大的过滤空间）

帧差分过滤方法之所以效果不好是因为视频的低级特征并没有被完全合理的使用，比如 Glimpse 方法结合像素级的帧差异和**静态的阈值，但其泛化性并不好**，这是因为不同的场景里相同的像素差值代表着不同的含义。因此如果作者能够**构建出特征类型，阈值和检测准确度要求这三者之间的关系**，或许就能取得比二元分类更好的效果。

因此作者设计了关于视频低级特征的几个机制：

- Reducto 服务器对历史视频数据进行离线分析，寻找每个查询类别对应的最佳特征

- 摄像头端根据视频内容计算完成的每秒变化的差分阈值（使用轻量级机器学习）

  对于某个query，server指定需要关注的特征，为了确定过滤特征使用的阈值，使用大量历史成对数据（针对某query，该特征的阈值设定为 x 时取得的检测准确率 y），抛弃所有达不到检测准确率的成对数据，。。。。。。

- 对于视频特征变化剧烈的情况，预测模型可能表现不佳，因为准确度不在相机上进行计算，所以相机端只对特征进行判断，**如果特征没有落入之前的所有簇中**，则说明特征偏移较大，此时相机**停止过滤并且向服务器发送信号来在线重新训练模型**，模型训练结束后传回相机（*这段时间中相机还会使用过滤策略吗？*）

因此作者构建了Reducto，它可以根据特征，查询准确性，视频内容的变化进行动态调整过滤决策。作者使用实时交通监控摄像头的视频来进行对比评估，任务选择的是针对人和车的目标识别，检测，计数任务。并且相比FilterForward和Chameleon取得了更好的效果。

#### 相机性能对算法的影响

**最新最先进的智能相机：**

近年来的智能相机甚至内置四核处理器（Ambarella）和小型GPU （DNNCam）从而可以轻松处理基于CNN/DNN的算法，对于这种相机可以直接将基于NN的过滤算法放置在相机侧。

**商用/部署摄像头：**

大规模商用摄像头成本大约20-100美元，带有一定的计算资源（单CPU无GPU）。并且考虑到规模，这些摄像头的更新换代速度较为缓慢，因此非常有必要考虑基于摄像头基础资源的过滤算法（这里假定摄像头都是具有一定的计算资源的）

## 视频特征的选取

使用CV社区的差分特征列表，根据特征计算量进行预分组，通过选择：

- 满足实时性
- 差分变化和各种任务的查询结果的变化高度相关

的特征来测试。

#### 低级特征：

- 像素差异（pixel difference）：通过逐个像素比对亮度值或者RGB三通道分别计算差值来得到差异，计算简单但是噪声较大。
- 边缘差异（edge difference）：通过Canny或者Sobel算子来计算梯度边缘信息，通过比对边缘图的像素差异或者别的计算方法来得到差异值，是结构性的差异可以一定程度上减少光照的影响，但噪声仍然可以制造出一些伪边缘来影响结果。

#### 高级特征：

- 尺度不变特征变换（SIFT）：根据算法提取关键点，并且针对关键点生成尺度和旋转不变的描述子，具有更高的抗噪性但计算开销大
- 加速鲁棒特征（SURF）：同样也是提取特征点并且对特征点进行描述，但相比SIFT计算量稍小一些

#### 低级特征的必要性和合理性

不同特征的检测速度对照表如下，

![image-20241208163352080](https://github.com/user-attachments/assets/9714c857-73df-4c4a-a2a8-090b4f2cd576)

作者发现在这样配置的相机上使用高级特征进行检测很难达到实时的速度，所以还是得使用低级特征来进行拓展（不包括角点检测因为角点低级特征的摄像头端检测速度也不够实时）

且作者还发现无论是在计数任务还是边界框任务中，Pixel、Edge 和 Area 特征的变化值都与查询结果的变化呈现出强相关性，这表明即使特征值本身存在一定噪声，使用这些特征仍能够在实时系统中有效预测查询结果的变化。

## 系统架构和工作流

![image-20241208164636352](https://github.com/user-attachments/assets/8bfc513c-8023-4b6c-88fc-e9118b163eee)

1. 离线profiler对几分钟的视频进行深入分析（检测目标，并且计算所有特征的差异值），寻找最适合每个查询类别的特征
   - 作者发现通常某个单个特征可以作为某类查询在各种不同相机和视频以及准确度要求下的最优特征
   - *profiler会将每一段视频的每一个特征都聚合在一起进行比对，在满足查询精度的情况下使用过滤最多帧的特征和对应的阈值（这里profiler是使用的历史hash table来得到的阈值吗，聚合仅仅是把所有特征放在一起比对吗）*
2. **确定当前场景最佳特征**：当用户指定查询目标和精度之后，server将最佳特征通知给相机，相机端开始准备传输帧。首先差异提取器Diff Extractor会计算server给出的最佳特征
3. **构建hash table确定阈值**：针对每一种查询特征，server都会用model trainer来训练一个确定阈值的简单回归模型，通过摄像头发来的前几帧数据提取特征并且使用K-means进行聚类，得到一个哈希表（hash table）key为聚类的类中的平均差异距离，value为对应的最佳阈值。server会把这个hash table发送到camera端用于查询过滤。构建Hash Table的详细过程见下文专门的章节。~~（这里hash table用来确定最佳阈值的做法完全没有看懂，为什么要对前几帧进行聚类？针对多簇平均差异距离-最佳阈值这种key-value对会出现有高差异值被过滤而第差异值不被过滤的情况，非常反直觉，并且这是使用camera前几帧构建的，也没有涉及到场景的变化或者准确率或者查询特征的变化。那为什么这种情况会训练出来一个hash table这种分段函数而不是一个固定值呢？还有就是在确定每个簇的平均差异距离和对应的最佳阈值的时候是怎么做的呢？）~~
4. **hash table再更新（在线训练）**：差异值距离hash table中的key过远时会将这些不匹配的帧发送给model trainer中添加到数据集中进行更新，由于不同场景（比如晴天和雨天）会导致聚类的结果相距甚远，因此离线的模型肯定不够，需要定时进行在线更新。这些用于训练的帧不会被进行任何过滤，且*用户可以选择是否保留model更新前的帧以供重新检测？*
5. **不同粒度的确定**：由于hash table使用的key是多帧的平均差异距离，因此在选择视频片段长度时过小的视频段延迟更低，但是受到的噪声影响更大，更大的视频段延迟更高，但是不易受到噪声影响。（*这里的视频段中的每个帧还需要走K-means聚类算法吗？*）最终凭经验作者使用每段时长1S。

#### 最佳特征和查询任务的关系

作者发现最佳特征在任务间经常变动，但对于某查询任务，不同视频或者不同目标精度基本不会影响最佳特征的变动，并且**Area低级特征适合计数类的查询，Pixel和Edge低级特征适合边界框类的查询。**

#### Hash Table构建细节

![image-20241209092319868](https://github.com/user-attachments/assets/9e243d78-8c1b-4983-a579-ecf6f42cb151)

由于最佳阈值随时间抖动幅度和频率都很高，因此需要动态调整特征阈值，构建Hash Table。

1. 用户给定查询任务，acc要求
2. 初期收集未过滤的帧来进行训练，假设每段视频是1s，30fps，也就是一共30帧，那么就可以构建得到3个29维的向量，每一维代表两帧之间的特征差异值，一共三种特征每种都构建一个。
3. 遍历预设定的候选阈值计算得到每个向量在每个特征的每个候选阈值下的查询acc，如果达不到acc要求就删除。
4. 留下的向量会使用K-means进行聚类（类数=5），每个data point是一个向量，向量之间衡量距离的函数作者并没有详细给出。
5. 最终每个簇内就可以找到满足所有acc要求的最合适的阈值（尽可能大，这样差异值小于阈值的帧就可以尽可能过滤从而节省更多空间）
6. Hash Table生成的Key是一个二元组（$V_{center}, V_{variance}$），$V_{center}$代表簇内所有向量的平均，$V_{variance}$的每个元素代表簇中任意两个向量的这个元素上最大的距离，也就是代表散度。
7. 构建好Hash Table之后camera端之后输入的视频就会去构建向量，聚类，并且计算$V_{center}, V_{variance}$从而在Hash Table中进行查询对应的最佳阈值（如果距离Hash Table中的所有Key都超过了预定距离则会触发Hash Table的再更新。
8. 得到阈值后过滤阈值以下的微小变化帧，将剩余的帧使用.264编码压缩发送到server。

## 评估

#### 数据集

使用北美各地部署的7个实时监控摄像头的公开视频流收集了25个10min长度的视频，包含全天时段，光照，天气，人/汽车的不同密度

#### 查询任务

- Tagging：返回帧中是否包含兴趣物体的二元分类任务
- Counting（计数）：返回帧内兴趣物体数量的任务
- Bounding Box Detection：返回帧中所有检测到的兴趣对象的边界框坐标，准确度使用mAP指标衡量（类似交并比）

#### 配置

GT使用YOLO进行计算，server配置8核CPU和Tesla V100，相机配置VM或树莓派，VM使用了256MB内存和1GHz CPU

#### baseline

- 完全不过滤的检测
- Reducto（Offline）完美过滤所有不会降低ACC的帧
- Tiny YOLO（压缩检测NN模型）
- FilterForward（二元分类模型）
- Cloudseg（超分辨还原）
- Chameleon（动态调整采样视频质量）

相比之下Reducto很优越，具体对比可见论文

## 感想

1. **低级特征使用的还是太少了，涵盖面太窄**，在非常多变的环境下我认为不具备参考意义，感觉相比同类的论文，轻量级的特征提取NN会拥有更好的效果并且具有更高的可扩展性，因为NN可以提取更多的信息，包括运动姿势等，从而实现检测任务的扩展。当然前提是轻量级的NN足够轻量。相比之下这种只基于Area/Edge/Pixel差异值的判断再加上复杂的逻辑规则来挖掘潜力的方法看上去并不好搞，而且想要超越别人的方法更是困难。
2. Reducto的过滤规则仍然是基于序列时序上特征差值的过滤，这种时序的过滤主要针对时间冗余进行处理，而**对于空间冗余基本没有涉及**，这也是后面论文对Reducto方法所诟病的地方之一。




