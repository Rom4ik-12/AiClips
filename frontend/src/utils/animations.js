export const getInterpolatedValue = (clip, property, playheadPos) => {
  // Базовое значение, если ключей нет или что-то пошло не так
  const baseValue = clip[property] !== undefined ? clip[property] : 
                    property === 'scale' || property === 'opacity' ? 100 : 0;

  if (!clip.keyframes || clip.keyframes.length === 0) {
    return baseValue;
  }

  // Фильтруем ключи только для нужного свойства и сортируем по времени (x)
  const propKeys = clip.keyframes
    .filter(kf => kf.property === property)
    .sort((a, b) => a.x - b.x);

  if (propKeys.length === 0) {
    return baseValue;
  }

  const relativeX = playheadPos - clip.x;

  // Если ползунок до первого ключа, возвращаем значение первого ключа
  if (relativeX <= propKeys[0].x) {
    return propKeys[0].value;
  }

  // Если ползунок после последнего ключа, возвращаем значение последнего ключа
  if (relativeX >= propKeys[propKeys.length - 1].x) {
    return propKeys[propKeys.length - 1].value;
  }

  // Ищем два ключа, между которыми находится ползунок
  for (let i = 0; i < propKeys.length - 1; i++) {
    const kf1 = propKeys[i];
    const kf2 = propKeys[i + 1];

    if (relativeX >= kf1.x && relativeX <= kf2.x) {
      // Linear Interpolation (Линейная интерполяция)
      const progress = (relativeX - kf1.x) / (kf2.x - kf1.x);
      return kf1.value + (kf2.value - kf1.value) * progress;
    }
  }

  return baseValue;
};
