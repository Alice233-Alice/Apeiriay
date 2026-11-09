<template>
  <div class="preset-panel panel">
    <div class="preset-header">
      <h3><i class="fa-solid fa-sliders"></i> 开局预设</h3>
      <p class="preset-desc">自定义角色初始属性，增加游戏自由度</p>
    </div>

    <div class="preset-content">
      <!-- 仅开局一显示：手动编辑自定义开场正文 -->
      <div v-if="isCustomOpeningEditable" class="preset-section custom-opening-section">
        <div class="section-title">
          <i class="fa-solid fa-pen-fancy"></i>
          <span>自定义开局正文</span>
        </div>
        <div class="inline-hint opening-hint">只会更新开局一，其他固定开局正文不会被覆盖。</div>
        <textarea
          v-model="customOpeningText"
          class="opening-textarea"
          rows="8"
          placeholder="填写开场场景、当前事件和希望从哪里开始。无需填写性别，人物设定继续沿用世界书。"
        ></textarea>
      </div>

      <!-- 境界修为 -->
      <div class="preset-section">
        <div class="section-title">
          <i class="fa-solid fa-circle-radiation"></i>
          <span>境界修为</span>
        </div>
        <div class="form-row">
          <label>境界等级</label>
          <div class="input-with-hint">
            <input v-model.number="formData.等级" type="number" min="1" :max="maxRealmLevel" />
            <span class="realm-hint">{{ currentRealmDescription }}</span>
          </div>
        </div>
        <div class="form-row">
          <label>当前修为</label>
          <input v-model.number="formData.修为" type="number" min="0" />
        </div>
      </div>

      <!-- 资质天赋 -->
      <div class="preset-section">
        <div class="section-title">
          <i class="fa-solid fa-gem"></i>
          <span>资质天赋</span>
        </div>
        <div class="form-row">
          <label>灵根</label>
          <input v-model="formData.灵根" type="text" />
        </div>
        <div class="form-row">
          <label>体质</label>
          <input v-model="formData.体质" type="text" />
        </div>
      </div>

      <!-- 功法兵器 -->
      <div class="preset-section">
        <div class="section-title">
          <i class="fa-solid fa-book-open-reader"></i>
          <span>功法兵器</span>
        </div>
        <div class="form-row">
          <label>功法</label>
          <input v-model="formData.功法" type="text" />
        </div>
        <div class="form-row">
          <label>本命兵器</label>
          <input v-model="formData.本命兵器" type="text" />
        </div>
      </div>

      <!-- 资源财富 -->
      <div class="preset-section">
        <div class="section-title">
          <i class="fa-solid fa-coins"></i>
          <span>资源财富</span>
        </div>
        <div v-for="grade in SPIRIT_STONE_GRADES" :key="grade" class="form-row">
          <label>{{ grade }}</label>
          <input v-model.number="formData.灵石[grade]" type="number" min="0" step="1" :aria-label="grade" />
        </div>
        <div class="inline-hint">四品分别记录实际枚数，百进制折算用于汇总；兑换依剧情结算。</div>
      </div>

      <!-- 身份信息 -->
      <div class="preset-section">
        <div class="section-title">
          <i class="fa-solid fa-user"></i>
          <span>身份信息</span>
        </div>
        <div class="form-row">
          <label>姓名</label>
          <input v-model="formData.姓名" type="text" />
        </div>
        <div class="form-row">
          <label>宗门</label>
          <input v-model="formData.宗门" type="text" />
        </div>
        <div class="form-row">
          <label>出身</label>
          <input v-model="formData.出身" type="text" />
        </div>
        <div class="form-row">
          <label>已活岁月</label>
          <input v-model.number="formData.已活岁月" type="number" min="0" />
        </div>
      </div>

      <!-- 位置信息 -->
      <div class="preset-section">
        <div class="section-title">
          <i class="fa-solid fa-map-location-dot"></i>
          <span>位置信息</span>
        </div>
        <div class="form-row">
          <label>当前区域</label>
          <input v-model="formData.当前区域" type="text" />
        </div>
        <div class="form-row">
          <label>所属层级</label>
          <input v-model="formData.所属层级" type="text" />
        </div>
        <div class="form-row vertical">
          <label>当前处境</label>
          <textarea
            v-model="formData.当前处境"
            rows="3"
            placeholder="一句话说明人在哪里、和谁在一起、眼下要做什么"
          ></textarea>
        </div>
      </div>

      <!-- 身心与历劫状态 -->
      <div class="preset-section">
        <div class="section-title">
          <i class="fa-solid fa-bolt"></i>
          <span>身心与历劫状态</span>
        </div>
        <div class="form-row">
          <label>真元</label>
          <input v-model.trim="formData.战斗状态.负荷.真元" type="text" list="essence-burden-options" />
          <datalist id="essence-burden-options">
            <option value="充盈">充盈</option>
            <option value="尚足">尚足</option>
            <option value="吃紧">吃紧</option>
            <option value="枯竭">枯竭</option>
          </datalist>
        </div>
        <div class="form-row">
          <label>神识</label>
          <input v-model.trim="formData.战斗状态.负荷.神识" type="text" list="soul-burden-options" />
          <datalist id="soul-burden-options">
            <option value="澄明">澄明</option>
            <option value="疲乏">疲乏</option>
            <option value="动荡">动荡</option>
            <option value="受创">受创</option>
          </datalist>
        </div>
        <div class="form-row">
          <label>肉身</label>
          <input v-model.trim="formData.战斗状态.负荷.肉身" type="text" list="body-burden-options" />
          <datalist id="body-burden-options">
            <option value="无恙">无恙</option>
            <option value="轻创">轻创</option>
            <option value="重创">重创</option>
            <option value="濒危">濒危</option>
          </datalist>
        </div>
        <div class="form-row">
          <label>正在渡劫</label>
          <select v-model="formData.渡劫状态.正在渡劫">
            <option :value="false">否</option>
            <option :value="true">是</option>
          </select>
        </div>
        <div class="form-row">
          <label>劫种</label>
          <select v-model="formData.渡劫状态.劫种">
            <option value="无">无</option>
            <option value="雷劫">雷劫</option>
            <option value="心劫">心劫</option>
            <option value="天劫">天劫</option>
            <option value="情劫">情劫</option>
            <option value="因果劫">因果劫</option>
            <option value="红尘劫">红尘劫</option>
            <option value="轮回劫">轮回劫</option>
          </select>
        </div>
        <div class="form-row">
          <label>劫难等级</label>
          <select v-model="formData.渡劫状态.劫难等级">
            <option value="无">无</option>
            <option value="小劫">小劫</option>
            <option value="中劫">中劫</option>
            <option value="大劫">大劫</option>
            <option value="天罚">天罚</option>
          </select>
        </div>
        <div class="form-row">
          <label>当前阶段</label>
          <input v-model.number="formData.渡劫状态.当前阶段" type="number" min="0" max="9" />
        </div>
        <div class="form-row">
          <label>总阶段数</label>
          <input v-model.number="formData.渡劫状态.总阶段数" type="number" min="0" max="9" />
        </div>
        <div class="form-row">
          <label>劫力承受</label>
          <input v-model.number="formData.渡劫状态.劫力承受" type="number" min="0" max="100" />
        </div>
        <div class="form-row form-row-top">
          <label>劫难描述</label>
          <textarea v-model="formData.渡劫状态.劫难描述" rows="2" placeholder="如：天雷三重，心魔并起" />
        </div>
        <div class="form-row form-row-top">
          <label>触发原因</label>
          <textarea v-model="formData.渡劫状态.触发原因" rows="2" placeholder="如：破境冲关，心境不稳" />
        </div>
        <div class="inline-hint">未处于渡劫中时，系统会自动清空活动中的劫难阶段与描述，仅保留结果类信息。</div>
      </div>

      <!-- 行踪任务 -->
      <div class="preset-section">
        <div class="section-title">
          <i class="fa-solid fa-scroll"></i>
          <span>行踪任务</span>
          <button class="btn-add-small" @click="addQuest">
            <i class="fa-solid fa-plus"></i>
          </button>
        </div>
        <div class="inline-hint">这里维护行事页的进行中任务及关联线索；应用时会覆盖当前任务列表。</div>
        <div v-if="Object.keys(formData.任务列表).length === 0" class="empty-hint">暂无任务，点击右上角添加</div>
        <div v-for="(task, taskId) in formData.任务列表" :key="taskId" class="item-card">
          <div class="item-header">
            <input v-model="task.名称" type="text" placeholder="任务名称" class="item-name-input" />
            <button class="btn-delete-small" @click="removeQuest(taskId as string)">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
          <div class="item-row">
            <div class="item-field">
              <label>任务类型</label>
              <select v-model="task.类型">
                <option value="主线">主线</option>
                <option value="支线">支线</option>
                <option value="每日">每日</option>
                <option value="临危受命">临危受命</option>
                <option value="秘境探索">秘境探索</option>
              </select>
            </div>
          </div>
          <div class="item-row full">
            <div class="item-field full">
              <label>任务目标</label>
              <textarea v-model="task.目标" placeholder="如：前往栖月洞府寻药，为疗伤做准备" rows="2"></textarea>
            </div>
          </div>
          <div class="item-row full">
            <div class="item-field full">
              <label>任务进度</label>
              <textarea v-model="task.进度" placeholder="已完成的事项或已发现的线索" rows="2"></textarea>
            </div>
          </div>
          <div class="item-row full">
            <div class="item-field full">
              <label>下一步</label>
              <textarea v-model="task.下一步" placeholder="尚待完成的事项，未明确时可留空" rows="2"></textarea>
            </div>
          </div>
          <div v-for="field in ['关联人物', '关联地点', '关联物品'] as const" :key="field" class="item-row full">
            <div class="item-field full">
              <label>{{ field }}</label
              ><input
                :value="task[field]?.join('、') || ''"
                placeholder="多个名称用顿号分隔，沿用资料中的名称"
                @change="
                  task[field] = ($event.target as HTMLInputElement).value
                    .split(/[、，,\n]/u)
                    .map(name => name.trim())
                    .filter(Boolean)
                "
              />
            </div>
          </div>
          <div class="item-row full">
            <div class="item-field full">
              <label>关联事件ID</label
              ><input v-model="task.关联事件ID" placeholder="对应世界图志中的现有事件名称，可留空" />
            </div>
          </div>
        </div>
      </div>

      <!-- 红颜初始关系 -->
      <div class="preset-section">
        <div class="section-title">
          <i class="fa-solid fa-heart"></i>
          <span>红颜初始关系</span>
        </div>
        <p class="section-hint">选择开局已结识的红颜，自定境界、修为、资质与初始关系</p>

        <!-- 可选红颜列表 -->
        <div class="companion-grid">
          <div
            v-for="(char, charName) in 红颜角色库"
            :key="charName"
            class="companion-option"
            :class="{ selected: isCompanionSelected(charName as string) }"
            @click="toggleCompanion(charName as string)"
          >
            <div class="companion-checkbox">
              <i v-if="isCompanionSelected(charName as string)" class="fa-solid fa-check"></i>
            </div>
            <div class="companion-info">
              <div class="companion-name">{{ charName }}</div>
              <div class="companion-meta">
                <span class="companion-realm">{{ getRealmDescription(formData.红颜[charName]?.等级 ?? char.级) }}</span>
              </div>
              <div class="companion-attr">{{ char.根 }} · {{ char.质 }}</div>
            </div>
          </div>
        </div>

        <!-- 已选红颜详细设置 -->
        <div v-if="Object.keys(formData.红颜).length > 0" class="selected-companions">
          <div class="selected-title">已选红颜设置</div>
          <datalist id="companion-relation-options">
            <option v-for="option in RELATION_OPTIONS" :key="option" :value="option" />
          </datalist>
          <div v-for="(companion, name) in formData.红颜" :key="name" class="companion-card">
            <div class="companion-card-header">
              <span class="companion-card-name">{{ name }}</span>
              <button class="btn-delete-small" @click="removeCompanion(name as string)">
                <i class="fa-solid fa-times"></i>
              </button>
            </div>
            <div class="companion-card-body">
              <div class="form-row">
                <label>境界</label>
                <select v-model.number="companion.等级" :aria-label="name + '境界'">
                  <option v-for="level in maxRealmLevel" :key="level" :value="level">
                    {{ getRealmDescription(level) }}
                  </option>
                </select>
              </div>
              <div class="form-row">
                <label>当前修为</label>
                <input v-model.number="companion.修为" type="number" min="0" step="any" :aria-label="name + '修为'" />
              </div>
              <details class="companion-customization">
                <summary>资质、功法与修炼详情</summary>
                <div v-for="field in ['灵根', '体质', '功法', '本命兵器'] as const" :key="field" class="form-row">
                  <label>{{ field }}</label>
                  <input v-model="companion[field]" type="text" :aria-label="name + field" />
                </div>
                <div v-for="grade in SPIRIT_STONE_GRADES" :key="grade" class="form-row">
                  <label>{{ grade }}</label>
                  <input
                    v-model.number="companion.灵石[grade]"
                    type="number"
                    min="0"
                    step="1"
                    :aria-label="name + grade"
                  />
                </div>
                <div v-for="field in ['已活岁月'] as const" :key="field" class="form-row">
                  <label>{{ field }}</label>
                  <input
                    v-model.number="companion[field]"
                    type="number"
                    min="0"
                    step="any"
                    :aria-label="name + field"
                  />
                </div>
                <div class="form-row">
                  <label>修炼阶段</label>
                  <select v-model="companion.修炼状态.阶段" :aria-label="name + '修炼阶段'">
                    <option
                      v-for="phase in ['修炼中', '瓶颈中', '突破中', '稳固中', '压境中']"
                      :key="phase"
                      :value="phase"
                    >
                      {{ phase }}
                    </option>
                  </select>
                </div>
                <div v-for="field in ['方式', '地点', '根基描述', '瓶颈原因'] as const" :key="field" class="form-row">
                  <label>{{ field === '方式' ? '修炼方式' : field === '地点' ? '修炼地点' : field }}</label>
                  <input v-model="companion.修炼状态[field]" type="text" :aria-label="name + field" />
                </div>
                <div v-for="field in ['计划年数', '已修炼年数'] as const" :key="field" class="form-row">
                  <label>{{ field }}</label>
                  <input
                    v-model.number="companion.修炼状态[field]"
                    type="number"
                    min="0"
                    step="any"
                    :aria-label="name + field"
                  />
                </div>
              </details>
              <div class="form-row">
                <label>好感度</label>
                <div class="favor-input-group">
                  <input v-model.number="companion.好感度" type="range" min="-200" max="200" class="favor-slider" />
                  <span class="favor-value" :class="getFavorClass(companion.好感度)">
                    {{ companion.好感度 }}
                  </span>
                </div>
              </div>
              <div class="form-row">
                <label>关系称谓</label>
                <input
                  v-model="companion.关系"
                  type="text"
                  list="companion-relation-options"
                  class="relation-input"
                  placeholder="可自定义，如：旧识、师友、命定之人"
                />
              </div>
              <div class="form-row form-row-top">
                <label>当前情绪</label>
                <textarea
                  v-model="companion.关系上下文.当前情绪"
                  class="relation-textarea"
                  rows="2"
                  placeholder="如：面上清冷，实则挂心"
                />
              </div>
              <div class="form-row form-row-top">
                <label>态度缘由</label>
                <textarea
                  v-model="companion.关系上下文.态度缘由"
                  class="relation-textarea"
                  rows="2"
                  placeholder="如：曾受你相助，因此愿暗中照拂"
                />
              </div>
              <div class="form-row form-row-top">
                <label>关系诉求</label>
                <textarea
                  v-model="companion.关系上下文.关系诉求"
                  class="relation-textarea"
                  rows="2"
                  placeholder="如：希望你先稳住根基，再谈情意"
                />
              </div>
              <div class="form-row form-row-top">
                <label>相处禁忌</label>
                <textarea
                  v-model="companion.关系上下文.相处禁忌"
                  class="relation-textarea"
                  rows="2"
                  placeholder="如：忌提旧伤，忌擅探识海"
                />
              </div>
              <div class="form-row form-row-top">
                <label>未了约定</label>
                <textarea
                  v-model="companion.关系上下文.未了约定"
                  class="relation-textarea"
                  rows="2"
                  placeholder="如：待你结丹后，再同赴北冥"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 神通列表 -->
      <div class="preset-section">
        <div class="section-title">
          <i class="fa-solid fa-wand-magic-sparkles"></i>
          <span>神通列表</span>
          <button class="btn-add-small" @click="addSkill">
            <i class="fa-solid fa-plus"></i>
          </button>
        </div>
        <div v-if="Object.keys(formData.神通列表).length === 0" class="empty-hint">暂无神通，点击右上角添加</div>
        <div v-for="(skill, skillName) in formData.神通列表" :key="skillName" class="item-card">
          <div class="item-header">
            <input v-model="skill.名称" type="text" placeholder="神通名称" class="item-name-input" />
            <button class="btn-delete-small" @click="removeSkill(skillName as string)">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
          <div class="item-row">
            <div class="item-field">
              <label>类型</label>
              <select v-model="skill.类型">
                <option value="功法">功法</option>
                <option value="神通">神通</option>
                <option value="秘术">秘术</option>
              </select>
            </div>
            <div class="item-field">
              <label>品阶</label>
              <select v-model="skill.品阶">
                <option value="凡">凡</option>
                <option value="黄">黄</option>
                <option value="玄">玄</option>
                <option value="地">地</option>
                <option value="天">天</option>
                <option value="仙">仙</option>
                <option value="圣">圣</option>
                <option value="先天">先天</option>
              </select>
            </div>
            <div class="item-field">
              <label>熟练度</label>
              <select v-model="skill.熟练度">
                <option value="入门">入门</option>
                <option value="熟练">熟练</option>
                <option value="精通">精通</option>
                <option value="大成">大成</option>
                <option value="圆满">圆满</option>
                <option value="化境">化境</option>
              </select>
            </div>
          </div>
          <div class="item-row full">
            <div class="item-field full">
              <label>描述</label>
              <textarea v-model="skill.描述" placeholder="神通描述..." rows="2"></textarea>
            </div>
          </div>
        </div>
      </div>

      <!-- 法宝 -->
      <div class="preset-section">
        <div class="section-title">
          <i class="fa-solid fa-gem"></i>
          <span>法宝</span>
          <button class="btn-add-small" @click="addTreasure">
            <i class="fa-solid fa-plus"></i>
          </button>
        </div>
        <div v-if="Object.keys(formData.法宝).length === 0" class="empty-hint">暂无法宝，点击右上角添加</div>
        <div v-for="(item, itemName) in formData.法宝" :key="itemName" class="item-card">
          <div class="item-header">
            <input v-model="item.名称" type="text" placeholder="法宝名称" class="item-name-input" />
            <button class="btn-delete-small" @click="removeTreasure(itemName as string)">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
          <div class="item-row">
            <div class="item-field">
              <label>品阶</label>
              <select v-model="item.品阶">
                <option value="凡器">凡器</option>
                <option value="法器">法器</option>
                <option value="灵器">灵器</option>
                <option value="法宝">法宝</option>
                <option value="灵宝">灵宝</option>
                <option value="仙器">仙器</option>
                <option value="圣器">圣器</option>
                <option value="道器">道器</option>
              </select>
            </div>
            <div class="item-field">
              <label>数量</label>
              <input v-model.number="item.数量" type="number" min="1" />
            </div>
          </div>
          <div class="item-row full">
            <div class="item-field full">
              <label>描述</label>
              <textarea v-model="item.描述" placeholder="法宝描述..." rows="2"></textarea>
            </div>
          </div>
        </div>
      </div>

      <!-- 储物戒（背包） -->
      <div class="preset-section">
        <div class="section-title">
          <i class="fa-solid fa-box-open"></i>
          <span>储物戒</span>
          <button class="btn-add-small" @click="addInventoryItem">
            <i class="fa-solid fa-plus"></i>
          </button>
        </div>
        <div class="inline-hint">功法玉简、丹药、材料放在储物戒；通用灵石不必重复登记成物品。</div>
        <div v-if="Object.keys(formData.背包).length === 0" class="empty-hint">暂无物品，点击右上角添加</div>
        <div v-for="(item, itemName) in formData.背包" :key="itemName" class="item-card">
          <div class="item-header">
            <input v-model="item.名称" type="text" placeholder="物品名称" class="item-name-input" />
            <button class="btn-delete-small" @click="removeInventoryItem(itemName as string)">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
          <div class="item-row">
            <div class="item-field">
              <label>品阶</label>
              <input v-model="item.品阶" type="text" placeholder="如：上品" />
            </div>
            <div class="item-field">
              <label>数量</label>
              <input v-model.number="item.数量" type="number" min="1" />
            </div>
          </div>
          <div class="item-row full">
            <div class="item-field full">
              <label>描述</label>
              <textarea v-model="item.描述" placeholder="物品描述..." rows="2"></textarea>
            </div>
          </div>
        </div>
      </div>

      <!-- 杂物袋 -->
      <div class="preset-section">
        <div class="section-title">
          <i class="fa-solid fa-bag-shopping"></i>
          <span>杂物袋</span>
          <button class="btn-add-small" @click="addMiscItem">
            <i class="fa-solid fa-plus"></i>
          </button>
        </div>
        <div class="inline-hint">随身杂物、凡俗用品放在杂物袋；通用灵石不必重复登记成物品。</div>
        <div v-if="Object.keys(formData.杂物袋).length === 0" class="empty-hint">暂无物品，点击右上角添加</div>
        <div v-for="(item, itemName) in formData.杂物袋" :key="itemName" class="item-card">
          <div class="item-header">
            <input v-model="item.名称" type="text" placeholder="物品名称" class="item-name-input" />
            <button class="btn-delete-small" @click="removeMiscItem(itemName as string)">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
          <div class="item-row">
            <div class="item-field">
              <label>品阶</label>
              <input v-model="item.品阶" type="text" placeholder="如：凡物" />
            </div>
            <div class="item-field">
              <label>数量</label>
              <input v-model.number="item.数量" type="number" min="1" />
            </div>
          </div>
          <div class="item-row full">
            <div class="item-field full">
              <label>描述</label>
              <textarea v-model="item.描述" placeholder="物品描述..." rows="2"></textarea>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="preset-actions">
      <button class="btn-apply" @click="applyPreset">
        <i class="fa-solid fa-check"></i>
        应用预设
      </button>
      <button class="btn-reset" @click="resetToDefault">
        <i class="fa-solid fa-rotate-left"></i>
        恢复默认
      </button>
    </div>

    <!-- 导入导出按钮 -->
    <div class="preset-actions secondary">
      <button class="btn-export" @click="exportPreset">
        <i class="fa-solid fa-file-export"></i>
        导出预设
      </button>
      <button class="btn-import" @click="triggerImport">
        <i class="fa-solid fa-file-import"></i>
        导入预设
      </button>
      <input ref="fileInput" type="file" accept=".json" style="display: none" @change="importPreset" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { copyQuestForPreset, type QuestPresetData as QuestData } from '../quest-preset';
import {
  CompanionSchema,
  ProtagonistSchema,
  extractSpiritStoneFromInventory,
  addSpiritStoneLedgers,
  normalizeSpiritStoneLedger,
  isSpiritStoneCurrencyItem,
  SPIRIT_STONE_GRADES,
  type SpiritStoneLedger,
  REALM_NAMES,
  REALM_STAGES,
  Schema,
  type SchemaType,
} from '../schema';
import { useDataStore } from '../store';

const store = useDataStore();

// 文件输入引用
const fileInput = ref<HTMLInputElement | null>(null);
const MANUAL_TRANSIENT_OVERRIDE_PATH = 'stat_data._系统设置._临时状态手动覆盖签名';
const CUSTOM_OPENING_SWIPE_ID = 1;
const CUSTOM_OPENING_TITLE = '【开局一·自定义】';
const CUSTOM_OPENING_CONTROL_BLOCK_PATTERN =
  /<UpdateVariable>[\s\S]*?<\/UpdateVariable>|<visual_cards>[\s\S]*?<\/visual_cards>/gi;

const isCustomOpeningEditable = ref(false);
const customOpeningText = ref('');
const customOpeningControlBlocks = ref('');

const maxRealmLevel = REALM_NAMES.length * REALM_STAGES.length;
const RELATION_OPTIONS = ['陌生人', '点头之交', '熟人', '好友', '知己', '心动', '暧昧', '恋人', '道侣'];

// 根据等级计算境界描述
const getRealmDescription = (level: number): string => {
  if (level < 1 || level > maxRealmLevel) return '未知';
  const majorIdx = Math.floor((level - 1) / 4);
  const minorIdx = (level - 1) % 4;
  return `${REALM_NAMES[majorIdx]}${REALM_STAGES[minorIdx]}`;
};

const normalizeInventorySpiritStone = (items: Record<string, ItemData>) =>
  extractSpiritStoneFromInventory(_.cloneDeep(items));

// 神通数据类型
interface SkillData {
  名称: string;
  描述: string;
  类型: '功法' | '神通' | '秘术';
  品阶: string;
  熟练度: string;
  领悟时间: number;
}

// 物品数据类型
interface ItemData {
  名称: string;
  描述: string;
  品阶: string;
  数量: number;
}

// 红颜数据类型
interface CompanionData {
  好感度: number;
  关系: string;
  关系上下文: {
    当前情绪: string;
    态度缘由: string;
    关系诉求: string;
    相处禁忌: string;
    未了约定: string;
  };
  等级: number;
  修为: number;
  灵根: string;
  体质: string;
  功法: string;
  本命兵器: string;
  神通列表: Record<string, SkillData>;
  灵石: SpiritStoneLedger;
  已活岁月: number;
  尝试突破: boolean;
  修炼状态: SchemaType['本尊']['修炼状态'];
  羁绊纪事: SchemaType['红颜'][string]['羁绊纪事'];
}

interface CharacterLibraryData {
  级: number;
  根: string;
  质: string;
  龄: string;
  属: string;
  法: string;
  器: string;
  通: string[];
  自定义立绘?: {
    正面: string;
    背面: string;
  };
}

interface CombatStatusData {
  负荷: {
    真元: string;
    神识: string;
    肉身: string;
  };
}

interface TribulationStatusData {
  正在渡劫: boolean;
  劫种: string;
  劫难等级: string;
  当前阶段: number;
  总阶段数: number;
  劫力承受: number;
  劫难描述: string;
  触发原因: string;
}

const 默认红颜角色库 = (Schema.parse({}).红颜角色库 || {}) as Record<string, CharacterLibraryData>;
const 红颜角色库 = computed<Record<string, CharacterLibraryData>>(() => ({
  ...默认红颜角色库,
  ...store.红颜角色库,
}));

// 表单数据
const formData = ref({
  等级: 1,
  修为: 0,
  修炼状态: ProtagonistSchema.parse({}).修炼状态,
  灵根: '',
  体质: '',
  功法: '',
  本命兵器: '',
  灵石: normalizeSpiritStoneLedger(),
  姓名: '',
  宗门: '',
  出身: '',
  已活岁月: 0,
  当前区域: '',
  所属层级: '',
  当前处境: '',
  战斗状态: {
    负荷: {
      真元: '充盈',
      神识: '澄明',
      肉身: '无恙',
    },
  } as CombatStatusData,
  渡劫状态: {
    正在渡劫: false,
    劫种: '无',
    劫难等级: '无',
    当前阶段: 0,
    总阶段数: 0,
    劫力承受: 100,
    劫难描述: '',
    触发原因: '',
  } as TribulationStatusData,
  任务列表: {} as Record<string, QuestData>,
  神通列表: {} as Record<string, SkillData>,
  法宝: {} as Record<string, ItemData>,
  背包: {} as Record<string, ItemData>,
  杂物袋: {} as Record<string, ItemData>,
  红颜: {} as Record<string, CompanionData>,
});

// 计算属性：当前境界描述
const currentRealmDescription = computed(() => getRealmDescription(formData.value.等级));

// 生成唯一ID
const generateId = () => `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const createCompanionDataFromLibraryEntry = (charData: CharacterLibraryData): CompanionData => {
  const 神通列表: Record<string, SkillData> = {};
  if (charData.通 && Array.isArray(charData.通)) {
    charData.通.forEach((skillName: string) => {
      神通列表[skillName] = {
        名称: skillName,
        描述: '',
        类型: '神通',
        品阶: '天',
        熟练度: '精通',
        领悟时间: Date.now(),
      };
    });
  }

  return {
    好感度: 0,
    关系: '陌生人',
    关系上下文: {
      当前情绪: '',
      态度缘由: '',
      关系诉求: '',
      相处禁忌: '',
      未了约定: '',
    },
    等级: charData.级,
    修为: 0,
    灵根: charData.根,
    体质: charData.质,
    功法: charData.法,
    本命兵器: charData.器,
    神通列表,
    灵石: normalizeSpiritStoneLedger(),
    已活岁月: Number(charData.龄.match(/实(?:历)?\s*(\d+)/u)?.[1] ?? 0),
    尝试突破: false,
    修炼状态: CompanionSchema.parse({ 等级: charData.级 }).修炼状态,
    羁绊纪事: {},
  };
};

// 添加神通
const addSkill = () => {
  const id = generateId();
  formData.value.神通列表[id] = {
    名称: '新神通',
    描述: '',
    类型: '神通',
    品阶: '凡',
    熟练度: '入门',
    领悟时间: Date.now(),
  };
};

// 删除神通
const removeSkill = (skillName: string) => {
  delete formData.value.神通列表[skillName];
};

// 添加法宝
const addTreasure = () => {
  const id = generateId();
  formData.value.法宝[id] = {
    名称: '新法宝',
    描述: '',
    品阶: '法器',
    数量: 1,
  };
};

// 删除法宝
const removeTreasure = (itemName: string) => {
  delete formData.value.法宝[itemName];
};

// 添加背包物品
const addInventoryItem = () => {
  const id = generateId();
  formData.value.背包[id] = {
    名称: '新物品',
    描述: '',
    品阶: '',
    数量: 1,
  };
};

// 删除背包物品
const removeInventoryItem = (itemName: string) => {
  delete formData.value.背包[itemName];
};

// 添加杂物袋物品
const addMiscItem = () => {
  const id = generateId();
  formData.value.杂物袋[id] = {
    名称: '新杂物',
    描述: '',
    品阶: '',
    数量: 1,
  };
};

// 删除杂物袋物品
const removeMiscItem = (itemName: string) => {
  delete formData.value.杂物袋[itemName];
};

// 添加任务
const addQuest = () => {
  const id = generateId();
  formData.value.任务列表[id] = copyQuestForPreset({
    名称: '新任务',
    类型: '支线',
    目标: '',
    状态: '进行中',
    创建时间: Date.now(),
  });
};

// 删除任务
const removeQuest = (taskId: string) => {
  delete formData.value.任务列表[taskId];
};

// 检查红颜是否已选中
const isCompanionSelected = (name: string): boolean => {
  return name in formData.value.红颜;
};

// 切换红颜选中状态
const toggleCompanion = (name: string) => {
  if (isCompanionSelected(name)) {
    delete formData.value.红颜[name];
  } else {
    // 从红颜角色库获取基础数据
    const charData = 红颜角色库.value[name];
    if (charData) {
      formData.value.红颜[name] = createCompanionDataFromLibraryEntry(charData);
    }
  }
};

// 移除已选红颜
const removeCompanion = (name: string) => {
  delete formData.value.红颜[name];
};

// 获取好感度的样式类
const getFavorClass = (favor: number): string => {
  if (favor >= 60) return 'favor-high';
  if (favor >= 30) return 'favor-good';
  if (favor >= 0) return 'favor-neutral';
  if (favor >= -30) return 'favor-low';
  return 'favor-hostile';
};

// 从当前数据加载
const loadCurrentData = () => {
  // 加载神通列表
  const 神通列表: Record<string, SkillData> = {};
  if (store.本尊.神通列表) {
    for (const [name, skill] of Object.entries(store.本尊.神通列表)) {
      神通列表[name] = {
        名称: skill.名称 || name,
        描述: skill.描述 || '',
        类型: skill.类型 || '神通',
        品阶: skill.品阶 || '凡',
        熟练度: skill.熟练度 || '入门',
        领悟时间: skill.领悟时间 || Date.now(),
      };
    }
  }

  // 加载法宝
  const 法宝: Record<string, ItemData> = {};
  if (store.本尊.法宝) {
    for (const [name, item] of Object.entries(store.本尊.法宝)) {
      法宝[name] = {
        名称: item.名称 || name,
        描述: item.描述 || '',
        品阶: item.品阶 || '',
        数量: item.数量 ?? 1,
      };
    }
  }

  // 加载背包
  const 背包: Record<string, ItemData> = {};
  if (store.本尊.背包) {
    for (const [name, item] of Object.entries(store.本尊.背包)) {
      背包[name] = {
        名称: item.名称 || name,
        描述: item.描述 || '',
        品阶: item.品阶 || '',
        数量: item.数量 ?? 1,
      };
    }
  }
  const normalizedTreasures = normalizeInventorySpiritStone(法宝);
  const normalizedBackpack = normalizeInventorySpiritStone(背包);

  // 加载杂物袋
  const 杂物袋: Record<string, ItemData> = {};
  if (store.本尊.杂物袋) {
    for (const [name, item] of Object.entries(store.本尊.杂物袋)) {
      杂物袋[name] = {
        名称: item.名称 || name,
        描述: item.描述 || '',
        品阶: item.品阶 || '',
        数量: item.数量 ?? 1,
      };
    }
  }
  const normalizedMiscBag = normalizeInventorySpiritStone(杂物袋);

  // 加载任务列表
  const 任务列表: Record<string, QuestData> = {};
  if (store.任务列表) {
    for (const [taskId, task] of Object.entries(store.任务列表)) {
      任务列表[taskId] = copyQuestForPreset(task);
    }
  }

  // 加载红颜
  const 红颜: Record<string, CompanionData> = {};
  if (store.红颜) {
    for (const [name, companion] of Object.entries(store.红颜)) {
      const 神通列表: Record<string, SkillData> = {};
      if (companion.神通列表) {
        for (const [skillName, skill] of Object.entries(companion.神通列表)) {
          神通列表[skillName] = {
            名称: skill.名称 || skillName,
            描述: skill.描述 || '',
            类型: skill.类型 || '神通',
            品阶: skill.品阶 || '凡',
            熟练度: skill.熟练度 || '入门',
            领悟时间: skill.领悟时间 || Date.now(),
          };
        }
      }
      红颜[name] = {
        好感度: companion.好感度 ?? 0,
        关系: companion.关系 ?? '陌生人',
        关系上下文: {
          当前情绪: companion.关系上下文?.当前情绪 ?? '',
          态度缘由: companion.关系上下文?.态度缘由 ?? '',
          关系诉求: companion.关系上下文?.关系诉求 ?? '',
          相处禁忌: companion.关系上下文?.相处禁忌 ?? '',
          未了约定: companion.关系上下文?.未了约定 ?? '',
        },
        等级: companion.等级 ?? 1,
        修为: companion.修为 ?? 0,
        灵根: companion.灵根 ?? '',
        体质: companion.体质 ?? '',
        功法: companion.功法 ?? '',
        本命兵器: companion.本命兵器 ?? '',
        神通列表,
        灵石: normalizeSpiritStoneLedger(companion.灵石),
        已活岁月: companion.已活岁月 ?? 0,
        尝试突破: companion.尝试突破 ?? false,
        修炼状态: CompanionSchema.parse(companion).修炼状态,
        羁绊纪事: _.cloneDeep(companion.羁绊纪事 ?? {}),
      };
    }
  }

  formData.value = {
    等级: store.本尊.等级 ?? 1,
    修为: store.本尊.修为 ?? 0,
    修炼状态: _.cloneDeep(store.本尊.修炼状态),
    灵根: store.本尊.灵根 ?? '',
    体质: store.本尊.体质 ?? '',
    功法: store.本尊.功法 ?? '',
    本命兵器: store.本尊.本命兵器 ?? '',
    灵石: addSpiritStoneLedgers(
      store.本尊.灵石,
      normalizedTreasures.spiritStone,
      normalizedBackpack.spiritStone,
      normalizedMiscBag.spiritStone,
    ),
    姓名: store.本尊.身份?.姓名 ?? '',
    宗门: store.本尊.身份?.宗门 ?? '',
    出身: store.本尊.身份?.出身 ?? '',
    已活岁月: store.本尊.已活岁月 ?? 0,
    当前区域: store.本尊.行踪?.当前区域 ?? '',
    所属层级: store.本尊.行踪?.所属层级 ?? '',
    当前处境: store.当前处境 ?? '',
    战斗状态: {
      负荷: {
        真元: store.本尊.战斗状态?.负荷?.真元 ?? '充盈',
        神识: store.本尊.战斗状态?.负荷?.神识 ?? '澄明',
        肉身: store.本尊.战斗状态?.负荷?.肉身 ?? '无恙',
      },
    },
    渡劫状态: {
      正在渡劫: store.本尊.渡劫状态?.正在渡劫 ?? false,
      劫种: store.本尊.渡劫状态?.劫种 ?? '无',
      劫难等级: store.本尊.渡劫状态?.劫难等级 ?? '无',
      当前阶段: store.本尊.渡劫状态?.当前阶段 ?? 0,
      总阶段数: store.本尊.渡劫状态?.总阶段数 ?? 0,
      劫力承受: store.本尊.渡劫状态?.劫力承受 ?? 100,
      劫难描述: store.本尊.渡劫状态?.劫难描述 ?? '',
      触发原因: store.本尊.渡劫状态?.触发原因 ?? '',
    },
    任务列表,
    神通列表,
    法宝: normalizedTreasures.inventory,
    背包: normalizedBackpack.inventory,
    杂物袋: normalizedMiscBag.inventory,
    红颜,
  };
};

const loadCustomOpeningContent = () => {
  isCustomOpeningEditable.value = false;
  customOpeningText.value = '';
  customOpeningControlBlocks.value = '';

  if (getCurrentMessageId() !== 0) return;

  const greetingMessage = getChatMessages(0, { include_swipes: true })[0];
  if (greetingMessage?.swipe_id !== CUSTOM_OPENING_SWIPE_ID || !greetingMessage.swipes?.[CUSTOM_OPENING_SWIPE_ID]) {
    return;
  }

  isCustomOpeningEditable.value = true;
  const rawContent = String(greetingMessage.swipes[CUSTOM_OPENING_SWIPE_ID]);
  customOpeningControlBlocks.value = (rawContent.match(CUSTOM_OPENING_CONTROL_BLOCK_PATTERN) ?? []).join('\n');
  customOpeningText.value = rawContent
    .replace(CUSTOM_OPENING_CONTROL_BLOCK_PATTERN, '')
    .replace(CUSTOM_OPENING_TITLE, '')
    .trim();
};

const normalizeCustomOpeningContent = (): string => {
  const narrative = customOpeningText.value.trim();
  const controlBlocks = customOpeningControlBlocks.value.trim();
  return [CUSTOM_OPENING_TITLE, narrative, controlBlocks].filter(Boolean).join('\n\n');
};

const applyCustomOpeningContent = async (content: string): Promise<boolean> => {
  if (!isCustomOpeningEditable.value) return true;

  try {
    const greetingMessage = getChatMessages(0, { include_swipes: true })[0];
    if (greetingMessage?.swipe_id !== CUSTOM_OPENING_SWIPE_ID || !greetingMessage.swipes?.[CUSTOM_OPENING_SWIPE_ID]) {
      toastr.error('当前已不是开局一，正文未修改');
      return false;
    }

    const swipes = _.cloneDeep(greetingMessage.swipes);
    swipes[CUSTOM_OPENING_SWIPE_ID] = content;
    await setChatMessages([{ message_id: greetingMessage.message_id, swipes, swipe_id: CUSTOM_OPENING_SWIPE_ID }], {
      refresh: 'affected',
    });
    customOpeningText.value = content;
    return true;
  } catch (error) {
    console.error('[踏月寻仙] 更新自定义开局正文失败', error);
    toastr.error('变量已应用，但自定义开局正文更新失败');
    return false;
  }
};

// 将formData的神通列表转换为MVU格式（以名称为key）
const convertSkillsToMvu = () => {
  const result: Record<string, SkillData> = {};
  for (const skill of Object.values(formData.value.神通列表)) {
    if (skill.名称) {
      result[skill.名称] = skill;
    }
  }
  return result;
};

// 将formData的物品列表转换为MVU格式（以名称为key）
const convertItemsToMvu = (items: Record<string, ItemData>) => {
  const result: Record<string, ItemData> = {};
  for (const item of Object.values(items)) {
    if (item.名称) {
      result[item.名称] = item;
    }
  }
  return result;
};

// 将formData的任务列表转换为MVU格式（保留当前编辑顺序与任务ID）
const convertQuestsToMvu = () => {
  const result: Record<string, QuestData> = {};
  for (const [taskId, task] of Object.entries(formData.value.任务列表)) {
    if (!String(task.名称 || '').trim() && !String(task.目标 || '').trim()) {
      continue;
    }
    result[taskId] = copyQuestForPreset(task);
  }
  return result;
};

// 将formData的红颜列表转换为MVU格式
const convertCompanionsToMvu = () => {
  const result: Record<string, any> = {};
  for (const [name, companion] of Object.entries(formData.value.红颜)) {
    // 转换神通列表为以名称为key的格式
    const 神通列表: Record<string, any> = {};
    for (const skill of Object.values(companion.神通列表)) {
      if (skill.名称) {
        神通列表[skill.名称] = skill;
      }
    }
    result[name] = {
      ...companion,
      神通列表,
    };
  }
  return result;
};

const getCurrentFloorMessageContent = (): string => {
  try {
    const messages = getChatMessages(getCurrentMessageId());
    return String(messages?.[0]?.message || '');
  } catch {
    return '';
  }
};

const buildManualTransientOverride = (targetMessageId: number | 'latest', content: string) => ({
  narrativeSignature: `${String(targetMessageId)}::${content.length}::${content.slice(0, 120)}`,
  updatedAt: Date.now(),
});

const createPeaceCombatState = (status: CombatStatusData) => ({
  ..._.cloneDeep(Schema.parse({}).本尊.战斗状态),
  负荷: _.cloneDeep(status.负荷),
});

// 应用预设
const applyPreset = async () => {
  const messageId = getCurrentMessageId();
  const customOpeningContent = isCustomOpeningEditable.value ? normalizeCustomOpeningContent() : '';
  const currentMessageContent = customOpeningContent || getCurrentFloorMessageContent();
  const normalizedTreasures = normalizeInventorySpiritStone(convertItemsToMvu(formData.value.法宝));
  const normalizedBackpack = normalizeInventorySpiritStone(convertItemsToMvu(formData.value.背包));
  const normalizedMiscBag = normalizeInventorySpiritStone(convertItemsToMvu(formData.value.杂物袋));
  const normalizedSpiritStone = addSpiritStoneLedgers(
    formData.value.灵石,
    normalizedTreasures.spiritStone,
    normalizedBackpack.spiritStone,
    normalizedMiscBag.spiritStone,
  );
  const patchData = {
    本尊: {
      等级: formData.value.等级,
      修为: formData.value.修为,
      修炼状态: _.cloneDeep(formData.value.修炼状态),
      灵根: formData.value.灵根,
      体质: formData.value.体质,
      功法: formData.value.功法,
      本命兵器: formData.value.本命兵器,
      灵石: normalizedSpiritStone,
      已活岁月: formData.value.已活岁月,
      身份: {
        姓名: formData.value.姓名,
        宗门: formData.value.宗门,
        出身: formData.value.出身,
      },
      行踪: {
        当前区域: formData.value.当前区域,
        所属层级: formData.value.所属层级,
      },
      战斗状态: createPeaceCombatState(formData.value.战斗状态),
      当前敌人: {},
      渡劫状态: {
        正在渡劫: formData.value.渡劫状态.正在渡劫,
        劫种: formData.value.渡劫状态.劫种,
        劫难等级: formData.value.渡劫状态.劫难等级,
        当前阶段: formData.value.渡劫状态.当前阶段,
        总阶段数: formData.value.渡劫状态.总阶段数,
        劫力承受: formData.value.渡劫状态.劫力承受,
        劫难描述: formData.value.渡劫状态.劫难描述,
        触发原因: formData.value.渡劫状态.触发原因,
      },
      神通列表: convertSkillsToMvu(),
      法宝: normalizedTreasures.inventory,
      背包: normalizedBackpack.inventory,
      杂物袋: normalizedMiscBag.inventory,
    },
    红颜: convertCompanionsToMvu(),
    任务列表: convertQuestsToMvu(),
    当前处境: formData.value.当前处境,
  };
  const favorSnapshot = Object.fromEntries(
    Object.entries(patchData.红颜).map(([name, companion]) => [name, Number(companion.好感度 ?? 0)]),
  ) as Record<string, number>;

  const applyToMessage = async (message_id: number | 'latest') => {
    const currentData = Mvu.getMvuData({ type: 'message', message_id });
    const nextData = _.cloneDeep(currentData ?? {});
    const currentStatData = _.get(nextData, 'stat_data', {}) as Record<string, unknown>;
    const mergedStatData = _.merge({}, currentStatData, patchData) as Record<string, unknown>;
    // 预设中的列表类数据应当“所填即最终结果”，不能和旧数据深度合并，否则会残留被删除项。
    _.set(mergedStatData, '本尊.神通列表', _.cloneDeep(patchData.本尊.神通列表));
    _.set(mergedStatData, '本尊.法宝', _.cloneDeep(patchData.本尊.法宝));
    _.set(mergedStatData, '本尊.背包', _.cloneDeep(patchData.本尊.背包));
    _.set(mergedStatData, '本尊.杂物袋', _.cloneDeep(patchData.本尊.杂物袋));
    _.set(mergedStatData, '本尊.战斗状态', _.cloneDeep(patchData.本尊.战斗状态));
    _.set(mergedStatData, '本尊.当前敌人', {});
    // 红颜预设同理：所选即最终列表
    _.set(mergedStatData, '红颜', _.cloneDeep(patchData.红颜));
    _.set(mergedStatData, '任务列表', _.cloneDeep(patchData.任务列表));
    // 预设属于手动校准，应同步刷新快照，避免被 AI 单回合增量限制截断。
    _.set(mergedStatData, '_好感度快照', _.cloneDeep(favorSnapshot));
    _.set(
      mergedStatData,
      '_系统设置._临时状态手动覆盖签名',
      buildManualTransientOverride(message_id, currentMessageContent).narrativeSignature,
    );
    _.set(nextData, 'stat_data', Schema.parse(mergedStatData));
    await Mvu.replaceMvuData(nextData, { type: 'message', message_id });
  };

  try {
    await waitGlobalInitialized('Mvu');

    // 同时更新当前楼层和 latest，避免“界面显示已改但下一楼继承旧值”。
    const targetMessageIds: Array<number | 'latest'> = [messageId, 'latest'];
    for (const targetMessageId of targetMessageIds) {
      await applyToMessage(targetMessageId);
    }

    const openingUpdated = await applyCustomOpeningContent(customOpeningContent);
    store.refresh();
    if (openingUpdated) {
      toastr.success(isCustomOpeningEditable.value ? '预设与自定义开局已应用' : '预设已应用并同步到MVU变量');
    }
  } catch (e) {
    console.error('[踏月寻仙] 应用预设失败，回退到直接写入变量', e);

    updateVariablesWith(
      vars => {
        _.set(vars, 'stat_data.本尊.等级', formData.value.等级);
        _.set(vars, 'stat_data.本尊.修为', formData.value.修为);
        _.set(vars, 'stat_data.本尊.修炼状态', _.cloneDeep(formData.value.修炼状态));
        _.set(vars, 'stat_data.本尊.灵根', formData.value.灵根);
        _.set(vars, 'stat_data.本尊.体质', formData.value.体质);
        _.set(vars, 'stat_data.本尊.功法', formData.value.功法);
        _.set(vars, 'stat_data.本尊.本命兵器', formData.value.本命兵器);
        _.set(vars, 'stat_data.本尊.灵石', normalizedSpiritStone);
        _.set(vars, 'stat_data.本尊.已活岁月', formData.value.已活岁月);
        _.set(vars, 'stat_data.本尊.身份.姓名', formData.value.姓名);
        _.set(vars, 'stat_data.本尊.身份.宗门', formData.value.宗门);
        _.set(vars, 'stat_data.本尊.身份.出身', formData.value.出身);
        _.set(vars, 'stat_data.本尊.行踪.当前区域', formData.value.当前区域);
        _.set(vars, 'stat_data.本尊.行踪.所属层级', formData.value.所属层级);
        _.set(vars, 'stat_data.本尊.战斗状态', createPeaceCombatState(formData.value.战斗状态));
        _.set(vars, 'stat_data.本尊.当前敌人', {});
        _.set(vars, 'stat_data.本尊.渡劫状态', _.cloneDeep(formData.value.渡劫状态));
        _.set(vars, 'stat_data.本尊.神通列表', convertSkillsToMvu());
        _.set(vars, 'stat_data.本尊.法宝', normalizedTreasures.inventory);
        _.set(vars, 'stat_data.本尊.背包', normalizedBackpack.inventory);
        _.set(vars, 'stat_data.本尊.杂物袋', normalizedMiscBag.inventory);
        _.set(vars, 'stat_data.红颜', convertCompanionsToMvu());
        _.set(vars, 'stat_data.任务列表', convertQuestsToMvu());
        _.set(vars, 'stat_data.当前处境', formData.value.当前处境);
        _.set(vars, 'stat_data._好感度快照', favorSnapshot);
        _.set(
          vars,
          MANUAL_TRANSIENT_OVERRIDE_PATH,
          buildManualTransientOverride(messageId, currentMessageContent).narrativeSignature,
        );
        return vars;
      },
      { type: 'message', message_id: messageId },
    );

    await applyCustomOpeningContent(customOpeningContent);
    store.refresh();
    toastr.warning('预设已写入当前楼层，但MVU同步失败');
  }
};

// 恢复默认
const resetToDefault = () => {
  const defaultData = Schema.parse({});
  formData.value = {
    等级: defaultData.本尊.等级 ?? 1,
    修为: defaultData.本尊.修为 ?? 0,
    修炼状态: _.cloneDeep(defaultData.本尊.修炼状态),
    灵根: defaultData.本尊.灵根 ?? '',
    体质: defaultData.本尊.体质 ?? '',
    功法: defaultData.本尊.功法 ?? '',
    本命兵器: defaultData.本尊.本命兵器 ?? '',
    灵石: normalizeSpiritStoneLedger(defaultData.本尊.灵石),
    姓名: defaultData.本尊.身份?.姓名 ?? '',
    宗门: defaultData.本尊.身份?.宗门 ?? '',
    出身: defaultData.本尊.身份?.出身 ?? '',
    已活岁月: defaultData.本尊.已活岁月 ?? 0,
    当前区域: defaultData.本尊.行踪?.当前区域 ?? '',
    所属层级: defaultData.本尊.行踪?.所属层级 ?? '',
    当前处境: defaultData.当前处境 ?? '',
    战斗状态: {
      负荷: _.cloneDeep(defaultData.本尊.战斗状态.负荷),
    },
    渡劫状态: {
      正在渡劫: defaultData.本尊.渡劫状态?.正在渡劫 ?? false,
      劫种: defaultData.本尊.渡劫状态?.劫种 ?? '无',
      劫难等级: defaultData.本尊.渡劫状态?.劫难等级 ?? '无',
      当前阶段: defaultData.本尊.渡劫状态?.当前阶段 ?? 0,
      总阶段数: defaultData.本尊.渡劫状态?.总阶段数 ?? 0,
      劫力承受: defaultData.本尊.渡劫状态?.劫力承受 ?? 100,
      劫难描述: defaultData.本尊.渡劫状态?.劫难描述 ?? '',
      触发原因: defaultData.本尊.渡劫状态?.触发原因 ?? '',
    },
    任务列表: {},
    神通列表: {},
    法宝: {},
    背包: {},
    杂物袋: {},
    红颜: {},
  };
  toastr.info('已恢复为默认值');
};

// 导出预设
const exportPreset = () => {
  const normalizedTreasures = normalizeInventorySpiritStone(convertItemsToMvu(formData.value.法宝));
  const normalizedBackpack = normalizeInventorySpiritStone(convertItemsToMvu(formData.value.背包));
  const normalizedMiscBag = normalizeInventorySpiritStone(convertItemsToMvu(formData.value.杂物袋));
  const normalizedSpiritStone = addSpiritStoneLedgers(
    formData.value.灵石,
    normalizedTreasures.spiritStone,
    normalizedBackpack.spiritStone,
    normalizedMiscBag.spiritStone,
  );
  const exportData = {
    version: '1.7',
    exportTime: new Date().toISOString(),
    preset: {
      基础属性: {
        等级: formData.value.等级,
        修为: formData.value.修为,
        修炼状态: _.cloneDeep(formData.value.修炼状态),
        灵根: formData.value.灵根,
        体质: formData.value.体质,
        功法: formData.value.功法,
        本命兵器: formData.value.本命兵器,
        灵石: normalizedSpiritStone,
        已活岁月: formData.value.已活岁月,
      },
      身份信息: {
        姓名: formData.value.姓名,
        宗门: formData.value.宗门,
        出身: formData.value.出身,
      },
      位置信息: {
        当前区域: formData.value.当前区域,
        所属层级: formData.value.所属层级,
        当前处境: formData.value.当前处境,
      },
      ...(isCustomOpeningEditable.value ? { 自定义开局正文: customOpeningText.value.trim() } : {}),
      历劫状态: {
        战斗状态: { 负荷: _.cloneDeep(formData.value.战斗状态.负荷) },
        渡劫状态: _.cloneDeep(formData.value.渡劫状态),
      },
      任务列表: convertQuestsToMvu(),
      神通列表: convertSkillsToMvu(),
      法宝: normalizedTreasures.inventory,
      背包: normalizedBackpack.inventory,
      杂物袋: normalizedMiscBag.inventory,
      红颜: convertCompanionsToMvu(),
    },
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `踏月寻仙_预设_${formData.value.姓名 || '未命名'}_${new Date().toLocaleDateString()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toastr.success('预设已导出');
};

// 触发导入
const triggerImport = () => {
  fileInput.value?.click();
};

// 导入预设
const importPreset = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (!data.preset) {
        toastr.error('无效的预设文件格式');
        return;
      }

      const preset = data.preset;
      const importsSpiritStone =
        Object.hasOwn(preset.基础属性 ?? {}, '灵石') ||
        ['法宝', '背包', '杂物袋'].some(container =>
          Object.entries(preset[container] ?? {}).some(([key, item]) =>
            isSpiritStoneCurrencyItem(key, item as ItemData),
          ),
        );
      if (importsSpiritStone) {
        formData.value.灵石 = normalizeSpiritStoneLedger(preset.基础属性?.灵石);
      }

      // 加载基础属性
      if (preset.基础属性) {
        formData.value.等级 = preset.基础属性.等级 ?? formData.value.等级;
        formData.value.修为 = preset.基础属性.修为 ?? formData.value.修为;
        if (preset.基础属性.修炼状态 != null) {
          formData.value.修炼状态 = ProtagonistSchema.parse(preset.基础属性).修炼状态;
        }
        formData.value.灵根 = preset.基础属性.灵根 ?? formData.value.灵根;
        formData.value.体质 = preset.基础属性.体质 ?? formData.value.体质;
        formData.value.功法 = preset.基础属性.功法 ?? formData.value.功法;
        formData.value.本命兵器 = preset.基础属性.本命兵器 ?? formData.value.本命兵器;
        formData.value.灵石 = normalizeSpiritStoneLedger(preset.基础属性.灵石 ?? formData.value.灵石);
        formData.value.已活岁月 = preset.基础属性.已活岁月 ?? formData.value.已活岁月;
      }

      // 加载身份信息
      if (preset.身份信息) {
        formData.value.姓名 = preset.身份信息.姓名 ?? formData.value.姓名;
        formData.value.宗门 = preset.身份信息.宗门 ?? formData.value.宗门;
        formData.value.出身 = preset.身份信息.出身 ?? formData.value.出身;
      }

      // 加载位置信息
      if (preset.位置信息) {
        formData.value.当前区域 = preset.位置信息.当前区域 ?? formData.value.当前区域;
        formData.value.所属层级 = preset.位置信息.所属层级 ?? formData.value.所属层级;
        formData.value.当前处境 = preset.位置信息.当前处境 ?? formData.value.当前处境;
      }

      if (isCustomOpeningEditable.value && typeof preset.自定义开局正文 === 'string') {
        customOpeningText.value = preset.自定义开局正文;
      }

      // 加载历劫状态
      if (preset.历劫状态?.战斗状态) {
        const migratedCombatState = Schema.parse({
          本尊: { 战斗状态: preset.历劫状态.战斗状态 },
        }).本尊.战斗状态;
        formData.value.战斗状态 = {
          负荷: _.cloneDeep(migratedCombatState.负荷),
        };
      }
      if (preset.历劫状态?.渡劫状态) {
        formData.value.渡劫状态 = {
          正在渡劫: preset.历劫状态.渡劫状态.正在渡劫 ?? formData.value.渡劫状态.正在渡劫,
          劫种: preset.历劫状态.渡劫状态.劫种 ?? formData.value.渡劫状态.劫种,
          劫难等级: preset.历劫状态.渡劫状态.劫难等级 ?? formData.value.渡劫状态.劫难等级,
          当前阶段: preset.历劫状态.渡劫状态.当前阶段 ?? formData.value.渡劫状态.当前阶段,
          总阶段数: preset.历劫状态.渡劫状态.总阶段数 ?? formData.value.渡劫状态.总阶段数,
          劫力承受: preset.历劫状态.渡劫状态.劫力承受 ?? formData.value.渡劫状态.劫力承受,
          劫难描述: preset.历劫状态.渡劫状态.劫难描述 ?? formData.value.渡劫状态.劫难描述,
          触发原因: preset.历劫状态.渡劫状态.触发原因 ?? formData.value.渡劫状态.触发原因,
        };
      }

      // 加载任务列表
      if (preset.任务列表) {
        formData.value.任务列表 = {};
        for (const [taskId, task] of Object.entries(preset.任务列表 as Record<string, QuestData>)) {
          formData.value.任务列表[taskId] = copyQuestForPreset(task);
        }
      }

      // 加载神通列表
      if (preset.神通列表) {
        formData.value.神通列表 = {};
        for (const [name, skill] of Object.entries(preset.神通列表 as Record<string, SkillData>)) {
          formData.value.神通列表[name] = {
            名称: skill.名称 || name,
            描述: skill.描述 || '',
            类型: skill.类型 || '神通',
            品阶: skill.品阶 || '凡',
            熟练度: skill.熟练度 || '入门',
            领悟时间: skill.领悟时间 || Date.now(),
          };
        }
      }

      // 加载法宝
      if (preset.法宝) {
        formData.value.法宝 = {};
        for (const [name, item] of Object.entries(preset.法宝 as Record<string, ItemData>)) {
          formData.value.法宝[name] = {
            名称: item.名称 || name,
            描述: item.描述 || '',
            品阶: item.品阶 || '',
            数量: item.数量 ?? 1,
          };
        }
      }

      if (preset.法宝) {
        const normalizedTreasures = normalizeInventorySpiritStone(formData.value.法宝);
        formData.value.法宝 = normalizedTreasures.inventory;
        formData.value.灵石 = addSpiritStoneLedgers(formData.value.灵石, normalizedTreasures.spiritStone);
      }

      // 加载背包
      if (preset.背包) {
        formData.value.背包 = {};
        for (const [name, item] of Object.entries(preset.背包 as Record<string, ItemData>)) {
          formData.value.背包[name] = {
            名称: item.名称 || name,
            描述: item.描述 || '',
            品阶: item.品阶 || '',
            数量: item.数量 ?? 1,
          };
        }
        const normalizedBackpack = normalizeInventorySpiritStone(formData.value.背包);
        formData.value.背包 = normalizedBackpack.inventory;
        formData.value.灵石 = addSpiritStoneLedgers(formData.value.灵石, normalizedBackpack.spiritStone);
      }

      // 加载杂物袋
      if (preset.杂物袋) {
        formData.value.杂物袋 = {};
        for (const [name, item] of Object.entries(preset.杂物袋 as Record<string, ItemData>)) {
          formData.value.杂物袋[name] = {
            名称: item.名称 || name,
            描述: item.描述 || '',
            品阶: item.品阶 || '',
            数量: item.数量 ?? 1,
          };
        }
        const normalizedMiscBag = normalizeInventorySpiritStone(formData.value.杂物袋);
        formData.value.杂物袋 = normalizedMiscBag.inventory;
        formData.value.灵石 = addSpiritStoneLedgers(formData.value.灵石, normalizedMiscBag.spiritStone);
      }

      // 加载红颜
      if (preset.红颜) {
        formData.value.红颜 = {};
        for (const [name, companion] of Object.entries(preset.红颜 as Record<string, CompanionData>)) {
          const 神通列表: Record<string, SkillData> = {};
          if (companion.神通列表) {
            for (const [skillName, skill] of Object.entries(companion.神通列表)) {
              神通列表[skillName] = {
                名称: skill.名称 || skillName,
                描述: skill.描述 || '',
                类型: skill.类型 || '神通',
                品阶: skill.品阶 || '凡',
                熟练度: skill.熟练度 || '入门',
                领悟时间: skill.领悟时间 || Date.now(),
              };
            }
          }
          formData.value.红颜[name] = {
            好感度: companion.好感度 ?? 0,
            关系: companion.关系 ?? '陌生人',
            关系上下文: {
              当前情绪: companion.关系上下文?.当前情绪 ?? '',
              态度缘由: companion.关系上下文?.态度缘由 ?? '',
              关系诉求: companion.关系上下文?.关系诉求 ?? '',
              相处禁忌: companion.关系上下文?.相处禁忌 ?? '',
              未了约定: companion.关系上下文?.未了约定 ?? '',
            },
            等级: companion.等级 ?? 1,
            修为: companion.修为 ?? 0,
            灵根: companion.灵根 ?? '',
            体质: companion.体质 ?? '',
            功法: companion.功法 ?? '',
            本命兵器: companion.本命兵器 ?? '',
            神通列表,
            灵石: normalizeSpiritStoneLedger(companion.灵石),
            已活岁月: companion.已活岁月 ?? 0,
            尝试突破: companion.尝试突破 ?? false,
            修炼状态: CompanionSchema.parse(companion).修炼状态,
            羁绊纪事: _.cloneDeep(companion.羁绊纪事 ?? {}),
          };
        }
      }

      toastr.success('预设已导入');
    } catch {
      toastr.error('解析预设文件失败');
    }
  };
  reader.readAsText(file);

  // 清空input以便可以重复导入同一文件
  input.value = '';
};

// 初始化加载当前数据
onMounted(() => {
  loadCurrentData();
  loadCustomOpeningContent();
});
</script>

<style lang="scss" scoped>
.preset-panel {
  padding: 20px;
  overflow-y: auto;
  max-height: 100%;

  .preset-header {
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 2px solid var(--border-color);

    h3 {
      font-size: 20px;
      font-weight: 600;
      color: var(--text-accent);
      margin: 0 0 8px 0;
      display: flex;
      align-items: center;
      gap: 10px;

      i {
        color: var(--accent-color);
      }
    }

    .preset-desc {
      margin: 0;
      font-size: 13px;
      color: var(--text-secondary);
      opacity: 0.8;
    }
  }

  .preset-content {
    display: flex;
    flex-direction: column;
    gap: 20px;
    margin-bottom: 24px;
  }

  .preset-section {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 16px;

    .section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 15px;
      font-weight: 600;
      color: var(--text-accent);
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border-color);

      i {
        color: var(--accent-color);
        font-size: 14px;
      }

      .btn-add-small {
        margin-left: auto;
        padding: 4px 10px;
        background: var(--accent-color);
        color: #2c1810;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s;

        &:hover {
          background: #f4d03f;
          transform: scale(1.05);
        }
      }
    }

    .empty-hint {
      text-align: center;
      color: var(--text-secondary);
      font-size: 13px;
      padding: 20px;
      opacity: 0.7;
    }

    .item-card {
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 12px;

      &:last-child {
        margin-bottom: 0;
      }

      .item-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 10px;

        .item-name-input {
          flex: 1;
          padding: 6px 10px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          color: var(--text-accent);
          font-size: 14px;
          font-weight: 600;

          &:focus {
            outline: none;
            border-color: var(--accent-color);
          }
        }

        .btn-delete-small {
          padding: 4px 8px;
          background: rgba(220, 53, 69, 0.2);
          color: #dc3545;
          border: 1px solid rgba(220, 53, 69, 0.3);
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;

          &:hover {
            background: rgba(220, 53, 69, 0.4);
            border-color: #dc3545;
          }
        }
      }

      .item-row {
        display: flex;
        gap: 12px;
        margin-bottom: 8px;

        &:last-child {
          margin-bottom: 0;
        }

        &.full {
          flex-direction: column;
        }

        .item-field {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;

          &.full {
            width: 100%;
          }

          label {
            font-size: 11px;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          input,
          select,
          textarea {
            padding: 6px 10px;
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            color: var(--text-primary);
            font-size: 13px;

            &:focus {
              outline: none;
              border-color: var(--accent-color);
            }
          }

          select {
            cursor: pointer;
          }

          textarea {
            resize: vertical;
            min-height: 40px;
            font-family: inherit;
          }
        }
      }
    }

    .form-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;

      &:last-child {
        margin-bottom: 0;
      }

      label {
        flex: 0 0 100px;
        font-size: 13px;
        color: var(--text-secondary);
        text-align: right;
      }

      &.form-row-top {
        align-items: flex-start;
      }

      .input-with-hint {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 12px;

        input {
          flex: 1;
          padding: 8px 12px;
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          color: var(--text-primary);
          font-size: 13px;
          transition: all 0.2s;

          &:focus {
            outline: none;
            border-color: var(--accent-color);
            box-shadow: 0 0 0 2px rgba(255, 215, 0, 0.1);
          }

          &::placeholder {
            color: var(--text-secondary);
            opacity: 0.5;
          }
        }

        .realm-hint {
          flex: 0 0 auto;
          font-size: 13px;
          color: var(--accent-color);
          font-weight: 600;
          white-space: nowrap;
        }
      }

      input,
      select,
      textarea {
        flex: 1;
        padding: 8px 12px;
        background: var(--bg-primary);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        color: var(--text-primary);
        font-size: 13px;
        transition: all 0.2s;

        &:focus {
          outline: none;
          border-color: var(--accent-color);
          box-shadow: 0 0 0 2px rgba(255, 215, 0, 0.1);
        }

        &::placeholder {
          color: var(--text-secondary);
          opacity: 0.5;
        }
      }

      select {
        cursor: pointer;
      }

      textarea {
        resize: vertical;
        min-height: 56px;
        font-family: inherit;
      }
    }
  }

  .custom-opening-section {
    border-color: var(--accent-color);

    .opening-hint {
      margin: -4px 0 10px;
    }

    .opening-textarea {
      width: 100%;
      box-sizing: border-box;
      resize: vertical;
      min-height: 140px;
    }
  }

  .preset-actions {
    display: flex;
    gap: 12px;
    padding-top: 16px;
    border-top: 2px solid var(--border-color);

    &.secondary {
      padding-top: 12px;
      border-top: 1px solid var(--border-color);
      margin-top: 8px;
    }

    button {
      flex: 1;
      padding: 12px 20px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;

      i {
        font-size: 14px;
      }
    }

    .btn-apply {
      background: linear-gradient(135deg, #d4af37 0%, #f4d03f 100%);
      color: #2c1810;
      box-shadow: 0 2px 8px rgba(212, 175, 55, 0.3);

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(212, 175, 55, 0.4);
      }

      &:active {
        transform: translateY(0);
      }
    }

    .btn-reset {
      background: var(--button-bg);
      color: var(--text-primary);
      border: 1px solid var(--border-color);

      &:hover {
        background: var(--button-hover);
        border-color: var(--accent-color);
      }

      &:active {
        background: var(--button-active);
      }
    }

    .btn-export {
      background: linear-gradient(135deg, #28a745 0%, #34ce57 100%);
      color: white;
      box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3);

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(40, 167, 69, 0.4);
      }

      &:active {
        transform: translateY(0);
      }
    }

    .btn-import {
      background: linear-gradient(135deg, #17a2b8 0%, #20c997 100%);
      color: white;
      box-shadow: 0 2px 8px rgba(23, 162, 184, 0.3);

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(23, 162, 184, 0.4);
      }

      &:active {
        transform: translateY(0);
      }
    }
  }
}

.inline-hint {
  font-size: 12px;
  color: var(--text-secondary);
  opacity: 0.82;
  line-height: 1.6;
  margin-top: 8px;
}

// 滚动条样式
.preset-panel {
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: var(--bg-secondary);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--button-bg);
    border-radius: 3px;

    &:hover {
      background: var(--button-hover);
    }
  }
}

// 红颜选择区域样式
.section-hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 12px;
  opacity: 0.8;
}

.companion-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}

.companion-option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--accent-color);
    background: rgba(255, 215, 0, 0.05);
  }

  &.selected {
    border-color: var(--accent-color);
    background: rgba(255, 215, 0, 0.1);

    .companion-checkbox {
      background: var(--accent-color);
      border-color: var(--accent-color);
      color: #2c1810;
    }
  }

  .companion-checkbox {
    flex: 0 0 20px;
    width: 20px;
    height: 20px;
    border: 2px solid var(--border-color);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    transition: all 0.2s;
  }

  .companion-info {
    flex: 1;
    min-width: 0;

    .companion-name {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-accent);
      margin-bottom: 4px;
    }

    .companion-meta {
      display: flex;
      gap: 8px;
      margin-bottom: 2px;

      .companion-realm {
        font-size: 11px;
        color: var(--text-secondary);
      }
    }

    .companion-attr {
      font-size: 11px;
      color: var(--text-secondary);
      opacity: 0.8;
    }
  }
}

.selected-companions {
  border-top: 1px solid var(--border-color);
  padding-top: 16px;

  .selected-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-accent);
    margin-bottom: 12px;
  }
}

.companion-customization {
  margin: 0 0 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);

  summary {
    margin-bottom: 12px;
    color: var(--text-accent);
    font-size: 13px;
    cursor: pointer;
  }
}

.companion-card {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin-bottom: 12px;
  overflow: hidden;

  &:last-child {
    margin-bottom: 0;
  }

  .companion-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    background: rgba(255, 215, 0, 0.05);
    border-bottom: 1px solid var(--border-color);

    .companion-card-name {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-accent);
    }
  }

  .companion-card-body {
    padding: 12px;

    .form-row {
      margin-bottom: 12px;

      &:last-child {
        margin-bottom: 0;
      }

      label {
        flex: 0 0 80px;
      }

      .favor-input-group {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 12px;

        .favor-slider {
          flex: 1;
          height: 6px;
          appearance: none;
          background: linear-gradient(to right, #dc3545 0%, #ffc107 50%, #28a745 100%);
          border-radius: 3px;
          cursor: pointer;

          &::-webkit-slider-thumb {
            appearance: none;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: var(--accent-color);
            border: 2px solid #2c1810;
            cursor: pointer;
          }
        }

        .favor-value {
          flex: 0 0 40px;
          text-align: center;
          font-weight: 600;
          font-size: 14px;

          &.favor-high {
            color: #28a745;
          }

          &.favor-good {
            color: #6bcb77;
          }

          &.favor-neutral {
            color: var(--text-secondary);
          }

          &.favor-low {
            color: #ffc107;
          }

          &.favor-hostile {
            color: #dc3545;
          }
        }
      }

      .relation-input,
      .relation-textarea {
        flex: 1;
        padding: 8px 12px;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        color: var(--text-primary);
        font-size: 13px;

        &:focus {
          outline: none;
          border-color: var(--accent-color);
        }
      }

      .relation-input {
        cursor: text;
      }

      .relation-textarea {
        resize: vertical;
        min-height: 52px;
        font-family: inherit;
      }
    }
  }
}

// 手机端响应式
@media screen and (max-width: 480px) {
  .preset-panel {
    padding: 16px;

    .preset-header h3 {
      font-size: 18px;
    }

    .preset-section {
      padding: 12px;

      .item-card {
        padding: 10px;

        .item-row {
          flex-direction: column;
          gap: 8px;
        }
      }

      .form-row {
        label {
          flex: 0 0 80px;
          font-size: 12px;
        }

        input {
          font-size: 12px;
          padding: 6px 10px;
        }
      }
    }

    .companion-grid {
      grid-template-columns: 1fr;
    }

    .preset-actions {
      flex-direction: column;

      button {
        padding: 10px 16px;
        font-size: 13px;
      }
    }
  }
}
</style>
