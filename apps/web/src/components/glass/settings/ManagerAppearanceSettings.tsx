import { Button, Divider, Form, InputNumber, Space, Switch, message } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppSettingsStore } from '@/store/appSettings'

export default function ManagerAppearanceSettings() {
  const { t } = useTranslation()

  const managerUiBlurEnabled = useAppSettingsStore((state) => state.managerUiBlurEnabled)
  const managerUiBlurRadiusPx = useAppSettingsStore((state) => state.managerUiBlurRadiusPx)
  const managerUiSurfaceBgOpacity = useAppSettingsStore((state) => state.managerUiSurfaceBgOpacity)
  const managerUiSurfaceBorderOpacity = useAppSettingsStore((state) => state.managerUiSurfaceBorderOpacity)
  const managerUiControlBgOpacity = useAppSettingsStore((state) => state.managerUiControlBgOpacity)
  const managerUiControlBorderOpacity = useAppSettingsStore((state) => state.managerUiControlBorderOpacity)

  const setManagerUiBlurEnabled = useAppSettingsStore((state) => state.setManagerUiBlurEnabled)
  const setManagerUiBlurRadiusPx = useAppSettingsStore((state) => state.setManagerUiBlurRadiusPx)
  const setManagerUiSurfaceBgOpacity = useAppSettingsStore((state) => state.setManagerUiSurfaceBgOpacity)
  const setManagerUiSurfaceBorderOpacity = useAppSettingsStore((state) => state.setManagerUiSurfaceBorderOpacity)
  const setManagerUiControlBgOpacity = useAppSettingsStore((state) => state.setManagerUiControlBgOpacity)
  const setManagerUiControlBorderOpacity = useAppSettingsStore((state) => state.setManagerUiControlBorderOpacity)

  const [saving, setSaving] = useState(false)
  const [formBlurEnabled, setFormBlurEnabled] = useState(managerUiBlurEnabled)
  const [formBlurRadiusPx, setFormBlurRadiusPx] = useState(managerUiBlurRadiusPx)
  const [formSurfaceBgOpacity, setFormSurfaceBgOpacity] = useState(managerUiSurfaceBgOpacity)
  const [formSurfaceBorderOpacity, setFormSurfaceBorderOpacity] = useState(managerUiSurfaceBorderOpacity)
  const [formControlBgOpacity, setFormControlBgOpacity] = useState(managerUiControlBgOpacity)
  const [formControlBorderOpacity, setFormControlBorderOpacity] = useState(managerUiControlBorderOpacity)

  useEffect(() => setFormBlurEnabled(managerUiBlurEnabled), [managerUiBlurEnabled])
  useEffect(() => setFormBlurRadiusPx(managerUiBlurRadiusPx), [managerUiBlurRadiusPx])
  useEffect(() => setFormSurfaceBgOpacity(managerUiSurfaceBgOpacity), [managerUiSurfaceBgOpacity])
  useEffect(() => setFormSurfaceBorderOpacity(managerUiSurfaceBorderOpacity), [managerUiSurfaceBorderOpacity])
  useEffect(() => setFormControlBgOpacity(managerUiControlBgOpacity), [managerUiControlBgOpacity])
  useEffect(() => setFormControlBorderOpacity(managerUiControlBorderOpacity), [managerUiControlBorderOpacity])

  const save = async () => {
    setSaving(true)
    try {
      await Promise.all([
        setManagerUiBlurEnabled(formBlurEnabled),
        setManagerUiBlurRadiusPx(formBlurRadiusPx),
        setManagerUiSurfaceBgOpacity(formSurfaceBgOpacity),
        setManagerUiSurfaceBorderOpacity(formSurfaceBorderOpacity),
        setManagerUiControlBgOpacity(formControlBgOpacity),
        setManagerUiControlBorderOpacity(formControlBorderOpacity)
      ])
      message.success(t('settingsSavedSuccessfully'))
    } catch (error) {
      console.error('保存管理器外观设置失败：', error)
      message.error(t('errorSavingSettings'))
    } finally {
      setSaving(false)
    }
  }

  const resetToDefault = async () => {
    setSaving(true)
    try {
      await Promise.all([
        setManagerUiBlurEnabled(true),
        setManagerUiBlurRadiusPx(10),
        setManagerUiSurfaceBgOpacity(0.72),
        setManagerUiSurfaceBorderOpacity(0.14),
        setManagerUiControlBgOpacity(0.6),
        setManagerUiControlBorderOpacity(0.14)
      ])
      message.success(t('settingsSavedSuccessfully'))
    } catch (error) {
      console.error('重置管理器外观设置失败：', error)
      message.error(t('errorSavingSettings'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Space direction="vertical" size="large" className="w-full">
      <Form layout="vertical">
        <Form.Item label={t('managerUiBlurEnabled')}>
          <Switch checked={formBlurEnabled} onChange={setFormBlurEnabled} />
          <div className="mt-1 text-xs text-gray-500">{t('managerUiBlurEnabledHelp')}</div>
        </Form.Item>

        <Form.Item label={t('managerUiBlurRadiusPx')}>
          <InputNumber
            value={formBlurRadiusPx}
            min={0}
            max={30}
            step={1}
            style={{ maxWidth: 240 }}
            onChange={(value) => setFormBlurRadiusPx(Number(value ?? 0))}
          />
          <div className="mt-1 text-xs text-gray-500">{t('managerUiBlurRadiusPxHelp')}</div>
        </Form.Item>

        <Divider />

        <Form.Item label={t('managerUiSurfaceBgOpacity')}>
          <InputNumber
            value={formSurfaceBgOpacity}
            min={0.35}
            max={0.95}
            step={0.02}
            style={{ maxWidth: 240 }}
            onChange={(value) => setFormSurfaceBgOpacity(Number(value ?? 0))}
          />
          <div className="mt-1 text-xs text-gray-500">{t('managerUiSurfaceBgOpacityHelp')}</div>
        </Form.Item>

        <Form.Item label={t('managerUiSurfaceBorderOpacity')}>
          <InputNumber
            value={formSurfaceBorderOpacity}
            min={0.06}
            max={0.45}
            step={0.02}
            style={{ maxWidth: 240 }}
            onChange={(value) => setFormSurfaceBorderOpacity(Number(value ?? 0))}
          />
          <div className="mt-1 text-xs text-gray-500">{t('managerUiSurfaceBorderOpacityHelp')}</div>
        </Form.Item>

        <Divider />

        <Form.Item label={t('managerUiControlBgOpacity')}>
          <InputNumber
            value={formControlBgOpacity}
            min={0.18}
            max={0.9}
            step={0.02}
            style={{ maxWidth: 240 }}
            onChange={(value) => setFormControlBgOpacity(Number(value ?? 0))}
          />
          <div className="mt-1 text-xs text-gray-500">{t('managerUiControlBgOpacityHelp')}</div>
        </Form.Item>

        <Form.Item label={t('managerUiControlBorderOpacity')}>
          <InputNumber
            value={formControlBorderOpacity}
            min={0.06}
            max={0.6}
            step={0.02}
            style={{ maxWidth: 240 }}
            onChange={(value) => setFormControlBorderOpacity(Number(value ?? 0))}
          />
          <div className="mt-1 text-xs text-gray-500">{t('managerUiControlBorderOpacityHelp')}</div>
        </Form.Item>

        <Space>
          <Button type="primary" loading={saving} onClick={() => save().catch(() => {})}>
            {t('save')}
          </Button>
          <Button disabled={saving} onClick={() => resetToDefault().catch(() => {})}>
            {t('resetToDefault')}
          </Button>
        </Space>
      </Form>
    </Space>
  )
}

